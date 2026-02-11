// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/contracts/interfaces/IPoolManager.sol";
import {PoolManager} from "@uniswap/v4-core/contracts/PoolManager.sol";
import {IHooks} from "@uniswap/v4-core/contracts/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/contracts/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/contracts/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/contracts/types/Currency.sol";
import {Counter} from "../src/Counter.sol";
import {HookMiner} from "./utils/HookMiner.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract CounterTest is Test {
    using CurrencyLibrary for Currency;

    // Test contracts
    PoolManager public poolManager;
    Counter public counter;
    MockERC20 public token0;
    MockERC20 public token1;
    PoolKey public poolKey;
    
    function setUp() public {
        // Deploy the pool manager
        poolManager = new PoolManager(500000);
        
        // Deploy tokens
        token0 = new MockERC20("Token 0", "TKN0", 18);
        token1 = new MockERC20("Token 1", "TKN1", 18);
        
        // Ensure token0 address < token1 address
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }
        
        // Deploy the hook with the correct address for the hook flags
        (address hookAddress, bytes32 salt) = HookMiner.find(
            address(this),
            uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG),
            type(Counter).creationCode,
            abi.encode(address(poolManager))
        );
        
        // Deploy the hook at the mined address
        counter = new Counter{salt: salt}(poolManager);
        
        // Create the pool key
        poolKey = PoolKey({
            currency0: Currency.wrap(address(token0)),
            currency1: Currency.wrap(address(token1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(counter)),
            hookData: bytes32(0)
        });
        
        // Initialize the pool
        poolManager.initialize(poolKey, 79228162514264337593543950336, "");
    }

    function testGetHookPermissions() public {
        Hooks.Permissions memory permissions = counter.getHookPermissions();
        assertFalse(permissions.beforeInitialize);
        assertFalse(permissions.afterInitialize);
        assertTrue(permissions.beforeAddLiquidity);
        assertFalse(permissions.afterAddLiquidity);
        assertTrue(permissions.beforeRemoveLiquidity);
        assertFalse(permissions.afterRemoveLiquidity);
        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);
        assertFalse(permissions.beforeDonate);
        assertFalse(permissions.afterDonate);
        assertFalse(permissions.beforeSwapReturnDelta);
        assertFalse(permissions.afterSwapReturnDelta);
        assertFalse(permissions.afterAddLiquidityReturnDelta);
        assertFalse(permissions.afterRemoveLiquidityReturnDelta);
    }

    function testBeforeSwap() public {
        uint256 initialCount = counter.beforeSwapCount(poolKey.toId());
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1000,
            sqrtPriceLimitX96: 0
        });
        counter._beforeSwap(address(this), poolKey, swapParams, "");
        uint256 finalCount = counter.beforeSwapCount(poolKey.toId());
        assertEq(finalCount, initialCount + 1);
    }

    function testAfterSwap() public {
        uint256 initialCount = counter.afterSwapCount(poolKey.toId());
        IPoolManager.SwapParams memory swapParams = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 1000,
            sqrtPriceLimitX96: 0
        });
        BalanceDelta memory balanceDelta;
        counter._afterSwap(address(this), poolKey, swapParams, balanceDelta, "");
        uint256 finalCount = counter.afterSwapCount(poolKey.toId());
        assertEq(finalCount, initialCount + 1);
    }

    function testBeforeAddLiquidity() public {
        uint256 initialCount = counter.beforeAddLiquidityCount(poolKey.toId());
        IPoolManager.ModifyLiquidityParams memory modifyLiquidityParams = IPoolManager.ModifyLiquidityParams({
            amount0Desired: 1000,
            amount1Desired: 1000,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp + 1000
        });
        counter._beforeAddLiquidity(address(this), poolKey, modifyLiquidityParams, "");
        uint256 finalCount = counter.beforeAddLiquidityCount(poolKey.toId());
        assertEq(finalCount, initialCount + 1);
    }

    function testBeforeRemoveLiquidity() public {
        uint256 initialCount = counter.beforeRemoveLiquidityCount(poolKey.toId());
        IPoolManager.ModifyLiquidityParams memory modifyLiquidityParams = IPoolManager.ModifyLiquidityParams({
            amount0Desired: 1000,
            amount1Desired: 1000,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp + 1000
        });
        counter._beforeRemoveLiquidity(address(this), poolKey, modifyLiquidityParams, "");
        uint256 finalCount = counter.beforeRemoveLiquidityCount(poolKey.toId());
        assertEq(finalCount, initialCount + 1);
    }
}