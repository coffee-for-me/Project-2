import React, { useState, useRef, useEffect } from 'react';
import { FileText, Upload, Download, Shield, CheckCircle, XCircle, Key, Info, AlertCircle, Copy, Save, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import Button from './ui/Button';
import { SimpleSignature } from '../utils/simpleSignature';

const SimpleDocumentSigner: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [sessionKey, setSessionKey] = useState<string>('');
  const [verificationKey, setVerificationKey] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [showMechanism, setShowMechanism] = useState(false);
  const [signatureInfo, setSignatureInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showSessionKey, setShowSessionKey] = useState(false);
  const [activeTab, setActiveTab] = useState<'sign' | 'verify'>('sign');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const verifyFileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // Generate session key on component mount
  useEffect(() => {
    const initializeKey = async () => {
      try {
        const key = await SimpleSignature.generateSessionKey();
        setSessionKey(key);
      } catch (error) {
        console.error('Failed to generate session key:', error);
        setError('Failed to initialize signing system');
      }
    };

    initializeKey();

    return () => {
      SimpleSignature.reset();
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setVerificationResult(null);
      setSignatureInfo(null);
    }
  };

  const handleVerifyFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setVerificationResult(null);
      setSignatureInfo(null);
    }
  };

  const handleSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      setError('');
    }
  };

  const signDocument = async () => {
    if (!selectedFile) {
      setError('Please select a file to sign');
      return;
    }

    if (!sessionKey) {
      setError('Session key not available. Please refresh and try again.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const signature = await SimpleSignature.signFile(selectedFile, sessionKey);
      setSignatureInfo(signature);

      const signatureBlob = SimpleSignature.createSignatureFile(signature);
      const url = URL.createObjectURL(signatureBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFile.name}.sig`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Document signing failed:', err);
      setError(`Failed to sign document: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyDocument = async () => {
    if (!selectedFile || !signatureFile) {
      setError('Please select both a document and its signature file');
      return;
    }

    if (!verificationKey.trim()) {
      setError('Please enter the verification key');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const parsedSignature = await SimpleSignature.parseSignatureFile(signatureFile);
      if (!parsedSignature) {
        setError('Invalid signature file format');
        setIsProcessing(false);
        return;
      }

      const isValid = await SimpleSignature.verifyFile(
        selectedFile,
        parsedSignature.signature,
        verificationKey.trim(),
        parsedSignature.timestamp
      );

      setVerificationResult(isValid);
      setSignatureInfo(parsedSignature);

    } catch (err) {
      console.error('Document verification failed:', err);
      setError('Failed to verify document. Please check your files and key.');
      setVerificationResult(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyKey = async () => {
    if (sessionKey) {
      try {
        await navigator.clipboard.writeText(sessionKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy key:', err);
      }
    }
  };

  const saveKey = () => {
    if (sessionKey) {
      const keyBlob = new Blob([sessionKey], { type: 'text/plain' });
      const url = URL.createObjectURL(keyBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'signing-key.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const obfuscateKey = (key: string): string => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '•'.repeat(key.length - 8) + key.slice(-4);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSignatureFile(null);
    setVerificationKey('');
    setVerificationResult(null);
    setSignatureInfo(null);
    setError('');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <FileText className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Document Signer</h1>
        <p className="text-xl text-gray-400 mb-6">Secure document signing with session-based HMAC keys</p>
        
        <button
          onClick={() => setShowMechanism(!showMechanism)}
          className="inline-flex items-center space-x-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm transition-all duration-200 border border-gray-700 hover:border-gray-600"
        >
          <Info className="w-4 h-4" />
          <span>{showMechanism ? 'Hide Technical Details' : 'How It Works'}</span>
        </button>
      </div>

      {/* Technical Mechanism Explanation */}
      {showMechanism && (
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 flex items-center">
            <Shield className="w-6 h-6 mr-3 text-blue-400" />
            HMAC-SHA256 Signature Mechanism
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600">
              <h3 className="font-semibold text-white mb-4 flex items-center">
                <Lock className="w-5 h-5 mr-2 text-green-400" />
                Signing Process
              </h3>
              <div className="space-y-3 text-gray-300">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">1</div>
                  <div>
                    <p className="font-medium">Session Key Generation</p>
                    <p className="text-sm text-gray-400">256-bit HMAC key generated using Web Crypto API</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">2</div>
                  <div>
                    <p className="font-medium">File Processing</p>
                    <p className="text-sm text-gray-400">Complete file content encoded with metadata</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">3</div>
                  <div>
                    <p className="font-medium">HMAC Signature</p>
                    <p className="text-sm text-gray-400">SHA-256 hash signed with session key</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">4</div>
                  <div>
                    <p className="font-medium">Signature File</p>
                    <p className="text-sm text-gray-400">Detached .sig file with verification data</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600">
              <h3 className="font-semibold text-white mb-4 flex items-center">
                <Unlock className="w-5 h-5 mr-2 text-blue-400" />
                Verification Process
              </h3>
              <div className="space-y-3 text-gray-300">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">1</div>
                  <div>
                    <p className="font-medium">Key Input</p>
                    <p className="text-sm text-gray-400">Original session key required for verification</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">2</div>
                  <div>
                    <p className="font-medium">File Reprocessing</p>
                    <p className="text-sm text-gray-400">Current file processed identically to signing</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">3</div>
                  <div>
                    <p className="font-medium">Signature Verification</p>
                    <p className="text-sm text-gray-400">HMAC comparison with original signature</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5">4</div>
                  <div>
                    <p className="font-medium">Integrity Check</p>
                    <p className="text-sm text-gray-400">Pass/fail result with detailed feedback</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-amber-900/30 border border-amber-700 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-amber-300 mb-2">Security Considerations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-amber-200">
                  <div>
                    <p className="font-medium mb-1">Key Management:</p>
                    <ul className="space-y-1 text-amber-300">
                      <li>• Save your session key securely</li>
                      <li>• Key required for future verification</li>
                      <li>• Each session generates unique keys</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium mb-1">File Integrity:</p>
                    <ul className="space-y-1 text-amber-300">
                      <li>• Any file modification breaks signature</li>
                      <li>• Filename and size are part of signature</li>
                      <li>• Timestamp prevents replay attacks</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="bg-gray-800 rounded-xl p-1 border border-gray-700">
          <button
            onClick={() => { setActiveTab('sign'); resetForm(); }}
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'sign'
                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <Shield className="w-4 h-4 inline-block mr-2" />
            Sign Document
          </button>
          <button
            onClick={() => { setActiveTab('verify'); resetForm(); }}
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'verify'
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            <CheckCircle className="w-4 h-4 inline-block mr-2" />
            Verify Document
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto">
        {activeTab === 'sign' ? (
          /* Document Signing Section */
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 shadow-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Sign Your Document</h2>
              <p className="text-gray-400">Create a cryptographic signature to ensure document integrity</p>
            </div>
            
            {/* Session Key Display */}
            <div className="mb-8">
              <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <Key className="w-5 h-5 mr-2 text-yellow-400" />
                    Your Session Key
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowSessionKey(!showSessionKey)}
                      className="p-2 bg-gray-600 hover:bg-gray-500 rounded-lg transition-colors"
                      title={showSessionKey ? "Hide Key" : "Show Key"}
                    >
                      {showSessionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={copyKey}
                      className={`p-2 rounded-lg transition-colors ${
                        copied ? 'bg-green-600' : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                      title="Copy Key"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={saveKey}
                      className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                      title="Save Key to File"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm break-all border border-gray-600">
                  <div className="text-gray-400 mb-2">Session Signing Key:</div>
                  <div className="text-white">
                    {sessionKey ? (showSessionKey ? sessionKey : obfuscateKey(sessionKey)) : 'Generating...'}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center space-x-2 text-amber-400">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Save this key! Required for verification.</span>
                  </div>
                  {copied && (
                    <span className="text-sm text-green-400 font-medium">✓ Copied to clipboard!</span>
                  )}
                </div>
              </div>
            </div>

            {/* File Selection */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Select Document to Sign
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-xl p-8 text-center cursor-pointer transition-all duration-200 hover:bg-gray-700/30"
                >
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-white mb-2">
                    {selectedFile ? selectedFile.name : 'Choose file to sign'}
                  </p>
                  <p className="text-gray-400">
                    {selectedFile 
                      ? `${formatFileSize(selectedFile.size)} • ${selectedFile.type || 'Unknown type'}`
                      : 'Click to browse or drag and drop'
                    }
                  </p>
                </div>
              </div>

              <Button
                onClick={signDocument}
                disabled={!selectedFile || !sessionKey || isProcessing}
                isLoading={isProcessing}
                className="w-full py-4 text-lg"
              >
                <Shield className="w-5 h-5 mr-2" />
                {isProcessing ? 'Signing Document...' : 'Sign Document'}
              </Button>

              {/* Signing Success */}
              {signatureInfo && verificationResult === null && (
                <div className="bg-green-900/30 border border-green-700 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-400" />
                    <span className="text-green-400 font-semibold text-lg">Document signed successfully!</span>
                  </div>
                  <p className="text-gray-300 mb-4">
                    Your signature file has been downloaded. Keep both the document and signature file together, 
                    along with your session key for future verification.
                  </p>
                  <div className="bg-green-800/30 rounded-lg p-4 space-y-2 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-green-300 font-medium">File:</span>
                        <span className="ml-2 text-gray-300">{signatureInfo.filename}</span>
                      </div>
                      <div>
                        <span className="text-green-300 font-medium">Size:</span>
                        <span className="ml-2 text-gray-300">{formatFileSize(signatureInfo.size)}</span>
                      </div>
                      <div>
                        <span className="text-green-300 font-medium">Signed:</span>
                        <span className="ml-2 text-gray-300">{formatDate(signatureInfo.timestamp)}</span>
                      </div>
                      <div>
                        <span className="text-green-300 font-medium">Type:</span>
                        <span className="ml-2 text-gray-300">{signatureInfo.type || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Document Verification Section */
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-gray-700 shadow-xl">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Verify Document</h2>
              <p className="text-gray-400">Check document integrity and signature authenticity</p>
            </div>
            
            <div className="space-y-6">
              {/* Document Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Select Document to Verify
                </label>
                <input
                  type="file"
                  ref={verifyFileInputRef}
                  onChange={handleVerifyFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => verifyFileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 hover:bg-gray-700/30"
                >
                  <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="font-medium text-white mb-1">
                    {selectedFile ? selectedFile.name : 'Choose document'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {selectedFile 
                      ? `${formatFileSize(selectedFile.size)}`
                      : 'Select the original document'
                    }
                  </p>
                </div>
              </div>

              {/* Signature File Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Select Signature File
                </label>
                <input
                  type="file"
                  ref={signatureInputRef}
                  onChange={handleSignatureFileSelect}
                  className="hidden"
                  accept=".sig,.json"
                />
                <div
                  onClick={() => signatureInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-600 hover:border-gray-500 rounded-xl p-6 text-center cursor-pointer transition-all duration-200 hover:bg-gray-700/30"
                >
                  <Key className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="font-medium text-white mb-1">
                    {signatureFile ? signatureFile.name : 'Choose signature file'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {signatureFile 
                      ? `${formatFileSize(signatureFile.size)}`
                      : 'Select the .sig file'
                    }
                  </p>
                </div>
              </div>

              {/* Verification Key Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Verification Key
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={verificationKey}
                    onChange={(e) => setVerificationKey(e.target.value)}
                    placeholder="Enter the session key used for signing"
                    className="w-full p-4 bg-gray-700 rounded-xl border border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono text-sm transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                    <Key className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  This must be the exact same key that was used to sign the document
                </p>
              </div>

              <Button
                onClick={verifyDocument}
                disabled={!selectedFile || !signatureFile || !verificationKey.trim() || isProcessing}
                isLoading={isProcessing}
                className="w-full py-4 text-lg"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                {isProcessing ? 'Verifying Document...' : 'Verify Document'}
              </Button>

              {/* Verification Result */}
              {verificationResult !== null && (
                <div className={`border-2 rounded-xl p-6 ${
                  verificationResult 
                    ? 'bg-green-900/30 border-green-700' 
                    : 'bg-red-900/30 border-red-700'
                }`}>
                  <div className="flex items-center space-x-3 mb-4">
                    {verificationResult ? (
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-400" />
                    )}
                    <div>
                      <h3 className={`text-xl font-semibold ${
                        verificationResult ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {verificationResult ? 'Verification Successful!' : 'Verification Failed!'}
                      </h3>
                      <p className={`text-sm ${
                        verificationResult ? 'text-green-300' : 'text-red-300'
                      }`}>
                        {verificationResult 
                          ? 'Document integrity confirmed and signature is authentic'
                          : 'Document may have been modified or wrong verification key'
                        }
                      </p>
                    </div>
                  </div>
                  
                  {signatureInfo && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-300">Original File:</span>
                          <span className="ml-2 text-gray-400">{signatureInfo.filename}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-300">File Size:</span>
                          <span className="ml-2 text-gray-400">{formatFileSize(signatureInfo.size)}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-300">Signed:</span>
                          <span className="ml-2 text-gray-400">{formatDate(signatureInfo.timestamp)}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-300">File Type:</span>
                          <span className="ml-2 text-gray-400">{signatureInfo.type || 'Unknown'}</span>
                        </div>
                      </div>
                      
                      <div className={`rounded-lg p-4 ${
                        verificationResult ? 'bg-green-800/30' : 'bg-red-800/30'
                      }`}>
                        <div className={`text-sm space-y-1 ${
                          verificationResult ? 'text-green-300' : 'text-red-300'
                        }`}>
                          {verificationResult ? (
                            <>
                              <p>✓ File integrity verified - no modifications detected</p>
                              <p>✓ Signature is authentic and matches the verification key</p>
                              <p>✓ Document metadata (name, size, type) is consistent</p>
                              <p>✓ Timestamp indicates when the document was signed</p>
                            </>
                          ) : (
                            <>
                              <p>✗ File may have been modified since signing</p>
                              <p>✗ Verification key does not match the signing key</p>
                              <p>✗ Signature verification failed</p>
                              <p>✗ Document integrity cannot be confirmed</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <XCircle className="w-6 h-6 text-red-400" />
              <div>
                <span className="text-red-400 font-semibold text-lg">Error</span>
                <p className="text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleDocumentSigner;