import React, { useState } from 'react';
import { Play, CheckCircle, XCircle, AlertTriangle, Info, Code2, Rocket, Loader2 } from 'lucide-react';
import Editor, { loader } from "@monaco-editor/react";
import { useAccount, useWriteContract } from 'wagmi';

// Define custom theme
const defineCustomTheme = (monaco: any) => {
  monaco.editor.defineTheme('uniguardTheme', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: 'ec4899', fontStyle: 'bold' },
      { token: 'type', foreground: 'ec4899' },
      { token: 'function', foreground: '3b82f6' },
      { token: 'string', foreground: '3b82f6' },
      { token: 'number', foreground: 'ec4899' },
      { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' }
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#111827',
      'editor.lineHighlightBackground': '#f3f4f6',
      'editorCursor.foreground': '#111827',
      'editor.selectionBackground': '#e5e7eb',
      'editor.inactiveSelectionBackground': '#f3f4f6'
    }
  });
};

const defaultFoundryTests = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Contract.sol";

contract ContractTest is Test {
    function testExample() public {
        assertTrue(true);
    }
}`;

interface TestResult {
  name: string;
  status: 'success' | 'failure' | 'skipped';
  gasUsed?: number;
  message?: string;
  trace?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
}

export function TestingSuite({ contractCode }: { contractCode: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestSuite[]>([]);
  const [testCode, setTestCode] = useState(defaultFoundryTests);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    defineCustomTheme(monaco);
    monaco.editor.setTheme('uniguardTheme');
  };

  const { isConnected } = useAccount();
  const { writeContract } = useWriteContract();

  // Extract contract name from code
  const extractContractName = (code: string): string => {
    const contractMatch = code.match(/contract\s+([a-zA-Z0-9_]+)/);
    return contractMatch ? contractMatch[1] : 'Hook';
  };

  const generateTests = () => {
    console.log('Generate Tests button clicked');
    setIsGeneratingTests(true);
    setError(null);
    
    console.log('Sending contract to test generator agent...');
    console.log('Contract name:', extractContractName(contractCode));
    console.log('Contract code length:', contractCode.length);
    
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('Request timed out after 60 seconds');
      controller.abort();
    }, 60000); // 60 second timeout
    
    console.log('Making fetch request to http://localhost:3001/generate-tests');
    // Make API call to the test generator agent
    fetch('http://localhost:3001/generate-tests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractCode: contractCode,
        contractName: extractContractName(contractCode),
        testType: 'unit'
      }),
      signal: controller.signal
    })
      .then(response => {
        console.log('Received response from server:', response.status, response.statusText);
        clearTimeout(timeoutId);
        if (!response.ok) {
          console.log('Response not OK, parsing error JSON');
          return response.json().then(errorData => {
            console.log('Error data:', errorData);
            throw new Error(errorData.message || 'Failed to generate tests');
          });
        }
        console.log('Response OK, parsing JSON');
        return response.json();
      })
      .then(data => {
        console.log('Tests generated successfully, data received:', Object.keys(data));
        console.log('Test suite length:', data.testSuite?.length || 0);
        // Set the generated test code
        setTestCode(data.testSuite);
      })
      .catch(error => {
        console.error('Failed to generate tests:', error);
        console.log('Error name:', error.name);
        console.log('Error message:', error.message);
        if (error.name === 'AbortError') {
          setError('Request timed out after 60 seconds. The test generation might be taking too long or the server might be unresponsive.');
        } else {
          setError(`Failed to generate tests: ${error.message}`);
        }
      })
      .finally(() => {
        console.log('Request completed, setting isGeneratingTests to false');
        setIsGeneratingTests(false);
      });
  };

  const runTests = () => {
    setIsRunning(true);
    setError(null);
    
    // Call the backend API to run tests
    fetch('http://localhost:3000/api/compile-and-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: contractCode,
        testCode: testCode
      })
    })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errorData => {
            throw new Error(errorData.error || 'Failed to run tests');
          });
        }
        return response.json();
      })
      .then(data => {
        console.log('Test results:', data);
        if (data.success) {
          setTestResults(data.results);
        } else {
          setError(`Test execution failed: ${data.error}`);
          console.error('Test execution details:', data.details);
        }
      })
      .catch(error => {
        console.error('Failed to run tests:', error);
        setError(`Failed to run tests: ${error.message}`);
      })
      .finally(() => {
        setIsRunning(false);
      });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failure':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'skipped':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-100';
      case 'failure':
        return 'bg-red-50 border-red-100';
      case 'skipped':
        return 'bg-yellow-50 border-yellow-100';
      default:
        return 'bg-gray-50 border-gray-100';
    }
  };

  return (
    <div className="mt-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Testing Suite</h2>
          <div className="flex gap-4">
            <button
              onClick={generateTests}
              disabled={isGeneratingTests}
              className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg ${
                isGeneratingTests ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isGeneratingTests ? (
                <>
                  <Loader2 size={18} className="animate-spin text-white" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Code2 size={18} className="text-white" />
                  <span>Generate Tests</span>
                </>
              )}
            </button>
            <button
              onClick={runTests}
              disabled={isRunning}
              className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all ${
                isRunning ? 'opacity-70 cursor-not-allowed' : 'shadow-md hover:shadow-lg'
              }`}
            >
              <Play size={18} />
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="relative">
          <div className="h-[400px] border border-pink-200 rounded-xl overflow-hidden">
            <Editor
              height="100%"
              defaultLanguage="sol"
              theme="vs"
              value={testCode}
              onChange={(value) => setTestCode(value || '')}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
              }}
            />
          </div>
          
          {isGeneratingTests && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 animate-ping opacity-20"></div>
                  <div className="absolute inset-3 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 animate-ping opacity-40 animation-delay-200"></div>
                  <div className="absolute inset-6 rounded-full bg-gradient-to-r from-pink-300 to-purple-300 animate-ping opacity-60 animation-delay-400"></div>
                  <div className="absolute inset-9 rounded-full bg-gradient-to-r from-pink-200 to-purple-200 animate-ping opacity-80 animation-delay-600"></div>
                  <div className="absolute inset-12 rounded-full bg-white animate-pulse"></div>
                </div>
                <p className="mt-6 text-gray-600 font-medium">Generating Tests...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {testResults.length > 0 && (
        <div className="space-y-6">
          {testResults.map((suite, suiteIndex) => (
            <div key={suiteIndex} className="border border-pink-100 rounded-xl p-6 bg-white/50">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{suite.name}</h3>
              <div className="space-y-3">
                {suite.tests.map((test, testIndex) => (
                  <div
                    key={testIndex}
                    className={`flex items-start gap-4 p-4 rounded-lg border ${getStatusColor(
                      test.status
                    )}`}
                  >
                    {getStatusIcon(test.status)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{test.name}</h4>
                        {test.gasUsed && (
                          <span className="text-sm text-gray-500">
                            Gas Used: {test.gasUsed.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {test.message && (
                        <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                      )}
                      {test.trace && (
                        <pre className="mt-2 p-2 bg-gray-800 text-gray-200 rounded-lg text-sm overflow-x-auto">
                          {test.trace}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}