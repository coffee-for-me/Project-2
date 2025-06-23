import React, { useState, useRef } from 'react';
import { FileText, Upload, Download, Shield, CheckCircle, XCircle, Key, Info, AlertCircle, Award, Lock } from 'lucide-react';
import Button from './ui/Button';
import { useCrypto } from '../context/CryptoContext';
import { DigitalSigner } from '../utils/signing';
import { DocumentSignature } from '../types';

/**
 * DocumentSigner Component
 * 
 * A completely independent document signing and verification system that operates
 * without affecting other UI components. This module provides:
 * 
 * DIGITAL SIGNATURES EXPLAINED:
 * ============================
 * 
 * PURPOSE:
 * Digital signatures serve three critical security functions:
 * 1. AUTHENTICATION - Proves who created/signed the document
 * 2. INTEGRITY - Ensures the document hasn't been tampered with
 * 3. NON-REPUDIATION - Signer cannot deny having signed the document
 * 
 * ALGORITHM USED:
 * This implementation uses ECDSA (Elliptic Curve Digital Signature Algorithm) with:
 * - P-256 curve (also known as secp256r1)
 * - SHA-256 hash function
 * - 256-bit key length
 * 
 * HOW IT WORKS:
 * 1. Document Hashing: The entire document is hashed using SHA-256
 * 2. Signature Creation: The hash is signed with the signer's private key using ECDSA
 * 3. Certificate Attachment: The signer's digital certificate is included
 * 4. Verification: Uses the public key from the certificate to verify the signature
 * 
 * SECURITY ROLE:
 * - Prevents document tampering (any change breaks the signature)
 * - Establishes trust through PKI certificate validation
 * - Provides audit trail with timestamps
 * - Enables secure document workflows without central authority
 * 
 * PKI INTEGRATION:
 * - Uses self-signed certificates for this demo
 * - Certificate contains signer's public key and identity
 * - Certificate Authority validates certificate authenticity
 * - Supports certificate expiration and validation
 */
const DocumentSigner: React.FC = () => {
  // Component state - completely isolated from other components
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [documentSignature, setDocumentSignature] = useState<DocumentSignature | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [showMechanism, setShowMechanism] = useState(false);
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  
  // File input refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  
  // Crypto context - only used for certificate and signing operations
  const crypto = useCrypto();

  /**
   * Handle file selection for signing/verification
   * Resets any previous state to ensure clean operation
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError('');
      setVerificationResult(null);
      setDocumentSignature(null);
    }
  };

  /**
   * Handle signature file selection for verification
   */
  const handleSignatureFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      setError('');
    }
  };

  /**
   * Sign a document using ECDSA digital signatures
   * 
   * Process:
   * 1. Validate prerequisites (file, keys, certificate)
   * 2. Generate SHA-256 hash of document
   * 3. Sign hash with ECDSA private key
   * 4. Create signature file with certificate
   * 5. Download signature file for user
   */
  const signDocument = async () => {
    // Validation
    if (!selectedFile) {
      setError('Please select a file to sign');
      return;
    }

    if (!crypto.signingKeyPair?.privateKey) {
      setError('Signing key not available. Please refresh and try again.');
      return;
    }

    if (!crypto.certificate) {
      setError('Digital certificate not available. Please ensure you have set a username.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Create digital signature using ECDSA
      const signature = await DigitalSigner.signDocument(
        selectedFile,
        crypto.signingKeyPair.privateKey,
        crypto.certificate
      );

      setDocumentSignature(signature);

      // Create detached signature file
      const signatureBlob = DigitalSigner.createSignatureFile(signature);
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

  /**
   * Verify a document's digital signature
   * 
   * Process:
   * 1. Parse signature file to extract signature and certificate
   * 2. Validate certificate authenticity and expiration
   * 3. Import signer's public key from certificate
   * 4. Verify document hash against signature
   * 5. Report verification result
   */
  const verifyDocument = async () => {
    if (!selectedFile || !signatureFile) {
      setError('Please select both a document and its signature file');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Parse the signature file
      const parsedSignature = await DigitalSigner.parseSignatureFile(signatureFile);
      if (!parsedSignature) {
        setError('Invalid signature file format');
        setIsProcessing(false);
        return;
      }

      // Verify the certificate first
      const isCertValid = await crypto.verifyCertificate(parsedSignature.certificate);
      if (!isCertValid) {
        setError('Invalid or expired certificate');
        setVerificationResult(false);
        setIsProcessing(false);
        return;
      }

      // Import the signer's public key
      const signerPublicKey = await crypto.importPublicKey(parsedSignature.certificate.publicKey);

      // Verify the document signature
      const isValid = await DigitalSigner.verifyDocumentSignature(
        selectedFile,
        parsedSignature,
        signerPublicKey
      );

      setVerificationResult(isValid);
      setDocumentSignature(parsedSignature);

    } catch (err) {
      console.error('Document verification failed:', err);
      setError('Failed to verify document. Please check your files and try again.');
      setVerificationResult(false);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Utility functions for display
   */
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

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header Section */}
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Document Signer</h1>
        <p className="text-gray-400">PKI-based digital signatures with ECDSA encryption</p>
        
        <div className="flex justify-center space-x-4 mt-4">
          <button
            onClick={() => setShowMechanism(!showMechanism)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
          >
            <Info className="w-4 h-4" />
            <span>{showMechanism ? 'Hide' : 'How it works'}</span>
          </button>
          
          <button
            onClick={() => setShowSecurityDetails(!showSecurityDetails)}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-700 hover:bg-indigo-600 rounded-lg text-sm transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span>{showSecurityDetails ? 'Hide' : 'Security Details'}</span>
          </button>
        </div>
      </div>

      {/* Technical Mechanism Explanation */}
      {showMechanism && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-400" />
            Digital Signature Mechanism
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-gray-300">
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center">
                <Lock className="w-4 h-4 mr-2 text-green-400" />
                Signing Process
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li><strong>Document Hashing:</strong> SHA-256 hash computed from entire file</li>
                <li><strong>ECDSA Signing:</strong> Hash signed with P-256 private key</li>
                <li><strong>Certificate Attachment:</strong> Digital certificate included for identity</li>
                <li><strong>Signature File:</strong> Detached .sig file created with all data</li>
              </ol>
            </div>
            
            <div className="bg-gray-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                Verification Process
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li><strong>Certificate Validation:</strong> Verify certificate authenticity</li>
                <li><strong>Hash Computation:</strong> Calculate SHA-256 of current document</li>
                <li><strong>Signature Verification:</strong> Use public key to verify ECDSA signature</li>
                <li><strong>Integrity Check:</strong> Compare hashes to detect tampering</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Security Details */}
      {showSecurityDetails && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Award className="w-5 h-5 mr-2 text-purple-400" />
            Cryptographic Security Details
          </h2>
          
          <div className="space-y-4 text-gray-300">
            <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-4">
              <h3 className="font-semibold text-purple-300 mb-2">Algorithm Specifications</h3>
              <ul className="text-sm space-y-1">
                <li>• <strong>Signature Algorithm:</strong> ECDSA (Elliptic Curve Digital Signature Algorithm)</li>
                <li>• <strong>Curve:</strong> P-256 (secp256r1) - 256-bit prime field</li>
                <li>• <strong>Hash Function:</strong> SHA-256 (Secure Hash Algorithm)</li>
                <li>• <strong>Key Length:</strong> 256 bits (equivalent to 3072-bit RSA)</li>
              </ul>
            </div>
            
            <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
              <h3 className="font-semibold text-green-300 mb-2">Security Guarantees</h3>
              <ul className="text-sm space-y-1">
                <li>• <strong>Authentication:</strong> Cryptographically proves document origin</li>
                <li>• <strong>Integrity:</strong> Any modification breaks the signature</li>
                <li>• <strong>Non-repudiation:</strong> Signer cannot deny signing</li>
                <li>• <strong>Timestamp:</strong> Provides temporal proof of signing</li>
              </ul>
            </div>
            
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <h3 className="font-semibold text-blue-300 mb-2">PKI Certificate System</h3>
              <ul className="text-sm space-y-1">
                <li>• <strong>Self-Signed CA:</strong> Session-based Certificate Authority</li>
                <li>• <strong>Certificate Validation:</strong> Cryptographic signature verification</li>
                <li>• <strong>Expiration Handling:</strong> Time-based certificate validity</li>
                <li>• <strong>Identity Binding:</strong> Public key tied to user identity</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Two-Column Layout for Signing and Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Document Signing Section */}
        <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-green-500">
          <h2 className="text-2xl font-semibold mb-4 flex items-center text-green-400">
            <Shield className="w-6 h-6 mr-2" />
            Sign Document
          </h2>
          
          {/* Certificate Status */}
          {crypto.certificate && (
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-3">
                <Key className="w-5 h-5 text-green-400" />
                <div>
                  <p className="font-medium text-white">
                    Certificate: {crypto.certificate.subject.split('-')[0]}
                  </p>
                  <p className="text-sm text-gray-400">
                    Valid until: {formatDate(crypto.certificate.expiresAt)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* File Selection */}
          <div className="space-y-4">
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.zip,.json"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="secondary"
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose File to Sign
              </Button>
            </div>

            {selectedFile && (
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{selectedFile.name}</p>
                    <p className="text-sm text-gray-400">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                    </p>
                  </div>
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
              </div>
            )}

            <Button
              onClick={signDocument}
              disabled={!selectedFile || !crypto.certificate || !crypto.signingKeyPair || isProcessing}
              isLoading={isProcessing}
              className="w-full"
            >
              <Shield className="w-4 h-4 mr-2" />
              {isProcessing ? 'Signing Document...' : 'Sign Document'}
            </Button>

            {/* Signing Success */}
            {documentSignature && verificationResult === null && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <span className="text-green-400 font-medium">Document signed successfully!</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Signature file (.sig) has been downloaded. Share it with your document for verification.
                </p>
                <div className="mt-3 text-xs text-gray-500">
                  <p><strong>Document Hash:</strong> {documentSignature.documentHash.slice(0, 32)}...</p>
                  <p><strong>Signed At:</strong> {formatDate(documentSignature.timestamp)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Document Verification Section */}
        <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-blue-500">
          <h2 className="text-2xl font-semibold mb-4 flex items-center text-blue-400">
            <CheckCircle className="w-6 h-6 mr-2" />
            Verify Document
          </h2>
          
          <div className="space-y-4">
            {/* Document Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Document to Verify
              </label>
              {!selectedFile && (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Document
                </Button>
              )}
              {selectedFile && (
                <div className="bg-gray-700 rounded-lg p-3">
                  <p className="text-sm text-white">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
                </div>
              )}
            </div>

            {/* Signature File Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Signature File
              </label>
              <input
                type="file"
                ref={signatureInputRef}
                onChange={handleSignatureFileSelect}
                className="hidden"
                accept=".sig,.json"
              />
              <Button
                onClick={() => signatureInputRef.current?.click()}
                variant="secondary"
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                Choose Signature File (.sig)
              </Button>

              {signatureFile && (
                <div className="bg-gray-700 rounded-lg p-3 mt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white">{signatureFile.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(signatureFile.size)}
                      </p>
                    </div>
                    <Key className="w-6 h-6 text-gray-400" />
                  </div>
                </div>
              )}
            </div>

            <Button
              onClick={verifyDocument}
              disabled={!selectedFile || !signatureFile || isProcessing}
              isLoading={isProcessing}
              className="w-full"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isProcessing ? 'Verifying Document...' : 'Verify Document'}
            </Button>

            {/* Verification Result */}
            {verificationResult !== null && (
              <div className={`border rounded-lg p-4 ${
                verificationResult 
                  ? 'bg-green-900/20 border-green-700' 
                  : 'bg-red-900/20 border-red-700'
              }`}>
                <div className="flex items-center space-x-2">
                  {verificationResult ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className={`font-medium ${
                    verificationResult ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {verificationResult ? 'Document verification successful!' : 'Document verification failed!'}
                  </span>
                </div>
                
                {documentSignature && (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-gray-300">
                      <strong>Signer:</strong> {documentSignature.certificate.subject.split('-')[0]}
                    </p>
                    <p className="text-gray-300">
                      <strong>Signed:</strong> {formatDate(documentSignature.timestamp)}
                    </p>
                    <p className="text-gray-300">
                      <strong>Document Hash:</strong> 
                      <span className="font-mono text-xs ml-2 break-all">
                        {documentSignature.documentHash}
                      </span>
                    </p>
                    {verificationResult && (
                      <div className="bg-green-800/30 rounded p-2 mt-2">
                        <p className="text-green-300 text-xs">
                          ✓ Certificate is valid and not expired<br/>
                          ✓ Document integrity verified<br/>
                          ✓ Digital signature is authentic
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Error</span>
          </div>
          <p className="text-red-300 mt-1">{error}</p>
        </div>
      )}
    </div>
  );
};

export default DocumentSigner;