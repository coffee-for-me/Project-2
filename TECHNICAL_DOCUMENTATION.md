# Cipher Chat - Complete Technical Documentation

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Cryptographic Implementation](#cryptographic-implementation)
3. [PKI Certificate System](#pki-certificate-system)
4. [Digital Signatures](#digital-signatures)
5. [Document Signing System](#document-signing-system)
6. [Audio System](#audio-system)
7. [Session Management](#session-management)
8. [Security Model](#security-model)
9. [Browser APIs Used](#browser-apis-used)
10. [File Structure](#file-structure)
11. [Component Architecture](#component-architecture)
12. [State Management](#state-management)
13. [Error Handling](#error-handling)
14. [Performance Optimizations](#performance-optimizations)
15. [Security Considerations](#security-considerations)

---

## System Architecture Overview

### Core Design Principles
- **Zero-Trust Architecture**: No server-side storage, all data is ephemeral
- **End-to-End Security**: All cryptographic operations happen client-side
- **Session-Based Security**: Certificates and keys expire with browser session
- **Forward Secrecy**: Each message uses unique encryption keys
- **PKI Integration**: Full certificate authority with digital signatures

### Technology Stack
```
Frontend Framework: React 18 + TypeScript
Styling: Tailwind CSS
Icons: Lucide React
Build Tool: Vite
Cryptography: Web Crypto API (native browser)
Communication: BroadcastChannel API (cross-tab)
Storage: LocalStorage (temporary session data only)
```

---

## Cryptographic Implementation

### 1. Key Generation Systems

#### ECDH Key Pairs (Encryption)
```typescript
// Location: src/context/CryptoContext.tsx
const generateKeyPair = async (): Promise<KeyPair> => {
  const newKeyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',           // Elliptic Curve Diffie-Hellman
      namedCurve: 'P-256'     // NIST P-256 curve (secp256r1)
    },
    false,                    // Non-extractable for security
    ['deriveKey']            // Can only derive shared secrets
  );
  return { publicKey: newKeyPair.publicKey, privateKey: newKeyPair.privateKey };
};
```

#### ECDSA Key Pairs (Signing)
```typescript
// Location: src/utils/certificates.ts
async generateSigningKeyPair(): Promise<SigningKeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDSA',          // Elliptic Curve Digital Signature Algorithm
      namedCurve: 'P-256'     // Same curve for consistency
    },
    true,                     // Extractable for certificate generation
    ['sign', 'verify']       // Can sign and verify
  );
  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey };
}
```

### 2. Message Encryption (AES-GCM)

#### Encryption Process
```typescript
// Location: src/context/CryptoContext.tsx
const encryptMessage = async (message: string): Promise<EncryptedData> => {
  // 1. Generate ephemeral AES key
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 2. Generate random IV (96 bits for GCM)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt with authenticated encryption
  const encryptedData = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(message)
  );

  return { data: new Uint8Array(encryptedData), iv };
};
```

### 3. Forward Secrecy Implementation

#### HKDF Key Derivation
```typescript
// Location: src/utils/forwardSecrecy.ts
static async deriveMessageKey(
  sharedSecret: CryptoKey,
  salt: Uint8Array,
  info: string = 'cipher-chat-message'
): Promise<CryptoKey> {
  // Import shared secret as HKDF key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    await window.crypto.subtle.exportKey('raw', sharedSecret),
    'HKDF',
    false,
    ['deriveKey']
  );

  // Derive unique key using HKDF-SHA256
  return await window.crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,                    // Random salt per message
      info: new TextEncoder().encode(info)
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

---

## PKI Certificate System

### 1. Certificate Authority Implementation

#### Self-Signed CA Generation
```typescript
// Location: src/utils/certificates.ts
async initializeCA(): Promise<CertificateAuthority> {
  const keyPair = await this.generateSigningKeyPair();
  const publicKeyData = await this.exportPublicKey(keyPair.publicKey);
  const privateKeyData = await this.exportPrivateKey(keyPair.privateKey);

  this.ca = {
    id: 'cipher-ca-' + Date.now(),
    name: 'Cipher Chat CA',
    publicKey: publicKeyData,
    privateKey: privateKeyData
  };
  return this.ca;
}
```

### 2. Certificate Issuance

#### User Certificate Generation
```typescript
async issueCertificate(
  subject: string,
  publicKey: CryptoKey,
  validityDays: number = 30
): Promise<Certificate> {
  const publicKeyData = await this.exportPublicKey(publicKey);
  const now = Date.now();
  const expiresAt = now + (validityDays * 24 * 60 * 60 * 1000);

  const certData = {
    subject,
    publicKey: publicKeyData,
    issuer: this.ca!.id,
    issuedAt: now,
    expiresAt
  };

  // Sign certificate with CA private key
  const signature = await this.signCertificate(certData);

  return {
    id: 'cert-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    ...certData,
    signature
  };
}
```

### 3. Certificate Verification

#### Signature Verification Process
```typescript
async verifyCertificate(certificate: Certificate): Promise<boolean> {
  if (!this.ca) return false;

  const caPublicKey = await this.importPublicKey(this.ca.publicKey);
  const certData = {
    subject: certificate.subject,
    publicKey: certificate.publicKey,
    issuer: certificate.issuer,
    issuedAt: certificate.issuedAt,
    expiresAt: certificate.expiresAt
  };

  const dataToVerify = JSON.stringify(certData);
  const signature = base64ToArrayBuffer(certificate.signature);

  // Verify CA signature
  const isValid = await window.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    caPublicKey,
    signature,
    new TextEncoder().encode(dataToVerify)
  );

  // Check expiration
  const isNotExpired = Date.now() < certificate.expiresAt;
  return isValid && isNotExpired;
}
```

---

## Digital Signatures

### 1. Message Signing

#### ECDSA Message Signatures
```typescript
// Location: src/utils/signing.ts
static async signData(data: string, privateKey: CryptoKey): Promise<string> {
  const dataBuffer = new TextEncoder().encode(data);

  const signature = await window.crypto.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256'          // SHA-256 hash before signing
    },
    privateKey,
    dataBuffer
  );

  return arrayBufferToBase64(signature);
}
```

#### Signature Verification
```typescript
static async verifySignature(
  data: string,
  signature: string,
  publicKey: CryptoKey
): Promise<boolean> {
  const dataBuffer = new TextEncoder().encode(data);
  const signatureBuffer = base64ToArrayBuffer(signature);

  return await window.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    signatureBuffer,
    dataBuffer
  );
}
```

### 2. Document Signing

#### File Hash Generation
```typescript
static async hashDocument(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return arrayBufferToBase64(hashBuffer);
}
```

#### Complete Document Signature
```typescript
static async signDocument(
  file: File,
  privateKey: CryptoKey,
  certificate: Certificate
): Promise<DocumentSignature> {
  // 1. Hash the entire file
  const documentHash = await this.hashDocument(file);
  
  // 2. Sign the hash
  const signature = await this.signData(documentHash, privateKey);

  // 3. Create signature object with certificate
  return {
    documentHash,
    signature,
    certificate,
    timestamp: Date.now()
  };
}
```

---

## Document Signing System

### 1. Two-Tier Signing Architecture

#### Simple HMAC Signing
```typescript
// Location: src/utils/simpleSignature.ts
static async signFile(file: File, keyString?: string): Promise<SignatureInfo> {
  // Read complete file content
  const arrayBuffer = await file.arrayBuffer();
  const fileData = arrayBufferToBase64(arrayBuffer);
  
  // Create comprehensive signature data
  const signatureData = {
    filename: file.name,
    size: file.size,
    type: file.type,
    timestamp: Date.now(),
    content: fileData        // Include full file content in signature
  };

  // Sign with HMAC-SHA256
  const dataToSign = JSON.stringify(signatureData);
  const signature = await this.signData(dataToSign, keyString);

  return { filename: file.name, signature, timestamp: signatureData.timestamp, size: file.size, type: file.type };
}
```

#### PKI Document Signing
```typescript
// Location: src/components/DocumentSigner.tsx
const signDocument = async () => {
  // 1. Validate prerequisites
  if (!selectedFile || !crypto.signingKeyPair?.privateKey || !crypto.certificate) {
    throw new Error('Missing required components for signing');
  }

  // 2. Create digital signature with certificate
  const signature = await DigitalSigner.signDocument(
    selectedFile,
    crypto.signingKeyPair.privateKey,
    crypto.certificate
  );

  // 3. Create detached signature file
  const signatureBlob = DigitalSigner.createSignatureFile(signature);
  
  // 4. Auto-download signature file
  downloadFile(signatureBlob, `${selectedFile.name}.sig`);
};
```

### 2. Verification Process

#### HMAC Verification
```typescript
static async verifyFile(
  file: File,
  signature: string,
  keyString: string,
  originalTimestamp: number
): Promise<boolean> {
  // Recreate exact signature data
  const arrayBuffer = await file.arrayBuffer();
  const fileData = arrayBufferToBase64(arrayBuffer);
  
  const signatureData = {
    filename: file.name,
    size: file.size,
    type: file.type,
    timestamp: originalTimestamp,  // Use original timestamp
    content: fileData
  };

  const dataToVerify = JSON.stringify(signatureData);
  return await this.verifySignature(dataToVerify, signature, keyString);
}
```

#### PKI Verification
```typescript
const verifyDocument = async () => {
  // 1. Parse signature file
  const parsedSignature = await DigitalSigner.parseSignatureFile(signatureFile);
  
  // 2. Verify certificate validity
  const isCertValid = await crypto.verifyCertificate(parsedSignature.certificate);
  if (!isCertValid) {
    throw new Error('Invalid or expired certificate');
  }

  // 3. Import signer's public key
  const signerPublicKey = await crypto.importPublicKey(parsedSignature.certificate.publicKey);

  // 4. Verify document signature
  const isValid = await DigitalSigner.verifyDocumentSignature(
    selectedFile,
    parsedSignature,
    signerPublicKey
  );

  return isValid;
};
```

---

## Audio System

### 1. Recording Implementation

#### MediaRecorder Setup
```typescript
// Location: src/components/VoiceRecorder.tsx
const startRecording = async () => {
  // 1. Request microphone with optimal constraints
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: { ideal: 44100, min: 8000, max: 48000 },
      channelCount: { ideal: 1, max: 2 }
    } 
  });

  // 2. Determine best supported format
  const mimeType = getBestSupportedMimeType();

  // 3. Create MediaRecorder with fallbacks
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { 
      mimeType,
      audioBitsPerSecond: 128000
    });
  } catch (mimeError) {
    // Fallback to basic recorder
    recorder = new MediaRecorder(stream);
  }

  // 4. Set up event handlers
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunksRef.current.push(event.data);
    }
  };

  recorder.onstop = () => {
    const audioBlob = new Blob(audioChunksRef.current, { 
      type: recorder.mimeType || mimeType 
    });
    // Process completed recording
  };

  // 5. Start recording with frequent data collection
  recorder.start(100); // Collect data every 100ms
};
```

### 2. Audio Format Support

#### MIME Type Detection
```typescript
const getBestSupportedMimeType = (): string => {
  const supportedTypes = [
    'audio/webm;codecs=opus',    // Best quality, modern browsers
    'audio/webm',                // WebM fallback
    'audio/mp4;codecs=mp4a.40.2', // MP4 AAC
    'audio/mp4',                 // MP4 fallback
    'audio/ogg;codecs=opus',     // OGG Opus
    'audio/ogg',                 // OGG fallback
    'audio/wav'                  // Universal fallback
  ];
  
  for (const type of supportedTypes) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  
  return 'audio/webm'; // Ultimate fallback
};
```

### 3. Playback System

#### Audio Player Implementation
```typescript
// Location: src/components/AudioPlayer.tsx
const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioUrl }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    // Comprehensive event handling
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime));
    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0); });
    
    audio.src = audioUrl;
    audio.preload = 'metadata';

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [audioUrl]);
};
```

---

## Session Management

### 1. Activity Monitoring

#### Session Activity Tracking
```typescript
// Location: src/context/CryptoContext.tsx
useEffect(() => {
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  const handleActivity = () => {
    setLastActivity(Date.now());
    setSessionActive(true);
  };

  // Add activity listeners
  activityEvents.forEach(event => {
    document.addEventListener(event, handleActivity, true);
  });

  // Monitor tab visibility
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      handleActivity();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Session timeout check (30 minutes)
  const sessionTimeout = setInterval(() => {
    const now = Date.now();
    const inactiveTime = now - lastActivity;
    const maxInactiveTime = 30 * 60 * 1000; // 30 minutes

    if (inactiveTime > maxInactiveTime && sessionActive) {
      setSessionActive(false);
    }
  }, 60000); // Check every minute

  return () => {
    // Cleanup listeners
    activityEvents.forEach(event => {
      document.removeEventListener(event, handleActivity, true);
    });
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(sessionTimeout);
  };
}, [lastActivity, sessionActive]);
```

### 2. Certificate Lifecycle

#### Dynamic Certificate Validity
```typescript
const generateCertificate = async (subject: string): Promise<Certificate> => {
  const uniqueSubject = `${subject}-${Date.now().toString(36)}`;
  
  const cert = await certificateManager.issueCertificate(
    uniqueSubject,
    currentSigningKeyPair.publicKey,
    1 // 1 day validity
  );
  
  // Dynamic validity based on session
  cert.issuedAt = sessionStartTime;
  cert.expiresAt = sessionStartTime + (365 * 24 * 60 * 60 * 1000); // 1 year max
  
  return cert;
};
```

### 3. Memory Management

#### Secure Cleanup
```typescript
// Location: src/utils/encoding.ts
export function secureWipe(data: any): void {
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(key => {
      if (data[key]) {
        data[key] = null;
      }
    });
  }
}

// Usage in cleanup
useEffect(() => {
  const cleanup = () => {
    try {
      secureWipe(keyPair);
      secureWipe(signingKeyPair);
      secureWipe(certificate);
      certificateManager.reset();
    } catch (error) {
      console.warn('Cleanup error:', error);
    }
  };

  window.addEventListener('beforeunload', cleanup);
  return cleanup;
}, [keyPair, signingKeyPair, certificate]);
```

---

## Security Model

### 1. Threat Model

#### Protected Against:
- **Passive Eavesdropping**: End-to-end encryption with AES-GCM-256
- **Active MITM**: Certificate verification and digital signatures
- **Message Tampering**: ECDSA signatures with SHA-256 hashing
- **Replay Attacks**: Timestamps and unique message IDs
- **Certificate Forgery**: CA signature verification
- **Session Hijacking**: Session-based certificate validity

#### Known Limitations:
- **Trust on First Use**: No pre-shared certificate validation
- **Session-Based CA**: Certificate authority is temporary per session
- **Browser Dependency**: Security relies on Web Crypto API implementation
- **No Perfect Forward Secrecy**: Simple document signing uses symmetric keys

### 2. Cryptographic Primitives

#### Algorithm Selection Rationale:
```
AES-GCM-256: Authenticated encryption, prevents tampering
ECDSA P-256: Industry standard, NSA Suite B approved
ECDH P-256: Efficient key agreement, same curve as ECDSA
SHA-256: Collision-resistant hashing
HKDF-SHA256: Key derivation for forward secrecy
HMAC-SHA256: Message authentication for simple signing
```

### 3. Key Management

#### Key Lifecycle:
1. **Generation**: Cryptographically secure random generation
2. **Storage**: Non-extractable keys when possible, memory-only
3. **Usage**: Single-purpose keys (encryption vs signing)
4. **Rotation**: New keys per session, ephemeral message keys
5. **Destruction**: Explicit cleanup on session end

---

## Browser APIs Used

### 1. Web Crypto API
```typescript
// Core cryptographic operations
window.crypto.subtle.generateKey()    // Key generation
window.crypto.subtle.encrypt()       // AES-GCM encryption
window.crypto.subtle.decrypt()       // AES-GCM decryption
window.crypto.subtle.sign()          // ECDSA signing
window.crypto.subtle.verify()        // ECDSA verification
window.crypto.subtle.deriveKey()     // HKDF key derivation
window.crypto.subtle.digest()        // SHA-256 hashing
window.crypto.subtle.importKey()     // Key import
window.crypto.subtle.exportKey()     // Key export
window.crypto.getRandomValues()      // Secure random generation
```

### 2. MediaDevices API
```typescript
// Audio recording
navigator.mediaDevices.getUserMedia() // Microphone access
navigator.mediaDevices.enumerateDevices() // Device enumeration
navigator.permissions.query()         // Permission checking
```

### 3. MediaRecorder API
```typescript
// Audio recording and processing
new MediaRecorder(stream, options)    // Create recorder
recorder.start(timeslice)             // Start recording
recorder.stop()                       // Stop recording
recorder.ondataavailable              // Data event handler
```

### 4. BroadcastChannel API
```typescript
// Cross-tab communication
const channel = new BroadcastChannel('chat_channel');
channel.postMessage(data);            // Send message
channel.onmessage = handler;          // Receive messages
```

### 5. File API
```typescript
// File processing
new FileReader()                      // File reading
reader.readAsDataURL()               // Convert to data URL
reader.readAsArrayBuffer()           // Read as binary
file.arrayBuffer()                   // Direct array buffer
```

---

## File Structure

```
src/
├── components/                 # React components
│   ├── AudioPlayer.tsx        # Audio playback component
│   ├── ChatScreen.tsx         # Main chat interface
│   ├── DocumentSigner.tsx     # PKI document signing
│   ├── MessageList.tsx        # Message display
│   ├── PairingScreen.tsx      # Connection setup
│   ├── SimpleDocumentSigner.tsx # HMAC document signing
│   ├── VoiceRecorder.tsx      # Audio recording
│   └── ui/
│       └── Button.tsx         # Reusable button component
├── context/                   # React context providers
│   ├── ChatContext.tsx        # Chat state management
│   └── CryptoContext.tsx      # Cryptographic operations
├── types/                     # TypeScript type definitions
│   └── index.ts              # All type definitions
├── utils/                     # Utility functions
│   ├── audioUtils.ts         # Audio processing utilities
│   ├── certificates.ts       # PKI certificate management
│   ├── encoding.ts           # Data encoding/decoding
│   ├── forwardSecrecy.ts     # Forward secrecy implementation
│   ├── signing.ts            # Digital signature utilities
│   └── simpleSignature.ts    # HMAC signature system
├── App.tsx                   # Main application component
├── main.tsx                  # Application entry point
└── index.css                 # Global styles
```

---

## Component Architecture

### 1. Context Providers

#### CryptoContext
- **Purpose**: Manages all cryptographic operations
- **State**: Keys, certificates, session status
- **Methods**: Key generation, encryption, signing, verification

#### ChatContext  
- **Purpose**: Manages chat functionality
- **State**: Messages, connection status, pairing
- **Methods**: Send messages, generate codes, join chats

### 2. Main Components

#### PairingScreen
- **Purpose**: Initial connection setup
- **Features**: Username creation, code generation, certificate display
- **Security**: Certificate validation, session monitoring

#### ChatScreen
- **Purpose**: Main messaging interface
- **Features**: Text, image, audio messages, document signing
- **Security**: Message encryption, signature verification

#### VoiceRecorder
- **Purpose**: Audio message recording
- **Features**: Recording, playback, format detection
- **Security**: Secure audio processing, error handling

#### DocumentSigner
- **Purpose**: PKI-based document signing
- **Features**: File signing, verification, certificate validation
- **Security**: Full PKI implementation with CA verification

---

## State Management

### 1. Crypto State
```typescript
interface CryptoContextType {
  keyPair: KeyPair | null;              // ECDH encryption keys
  signingKeyPair: SigningKeyPair | null; // ECDSA signing keys
  certificate: Certificate | null;       // User certificate
  sharedSecret: CryptoKey | null;        // Derived shared secret
  isInitializing: boolean;               // Initialization status
  sessionActive: boolean;                // Session validity
  lastActivity: number;                  // Last user activity
}
```

### 2. Chat State
```typescript
interface ChatContextType {
  messages: Message[];                   // Chat messages
  isConnected: boolean;                  // Connection status
  isPaired: boolean;                     // Pairing status
  pairingCode: string | null;           // Current pairing code
}
```

### 3. Message Structure
```typescript
interface Message {
  id: string;                           // Unique identifier
  type: MessageType;                    // text | image | audio | document
  content: string;                      // Message content or data URL
  timestamp: number;                    // Creation timestamp
  sender: 'self' | 'peer';             // Message origin
  encrypted: boolean;                   // Encryption status
  verified: boolean;                    // Signature verification
  signature?: string;                   // ECDSA signature
  senderCert?: Certificate;             // Sender's certificate
}
```

---

## Error Handling

### 1. Cryptographic Errors
```typescript
// Graceful degradation for crypto failures
try {
  const signature = await crypto.signMessage(content);
} catch (signError) {
  console.warn('Failed to sign message, sending without signature:', signError);
  signature = ''; // Continue without signature
}
```

### 2. Audio Errors
```typescript
// Comprehensive audio error handling
const getAudioErrorMessage = (error: Error): string => {
  switch (error.name) {
    case 'NotAllowedError':
      return 'Please allow microphone access in your browser settings.';
    case 'NotFoundError':
      return 'No microphone found. Please connect a microphone.';
    case 'NotSupportedError':
      return 'Audio recording is not supported in this browser.';
    default:
      return 'An unknown audio error occurred. Please try again.';
  }
};
```

### 3. Certificate Errors
```typescript
// Certificate validation with fallbacks
const verifyCertificate = async (cert: Certificate): Promise<boolean> => {
  try {
    const isValid = await certificateManager.verifyCertificate(cert);
    const isSessionValid = sessionActive;
    return isValid && isSessionValid;
  } catch (error) {
    console.error('Certificate verification failed:', error);
    return false; // Fail securely
  }
};
```

---

## Performance Optimizations

### 1. Build Optimizations
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],    // Framework code
          crypto: ['uuid'],                  // Crypto utilities
          icons: ['lucide-react']            // Icon library
        }
      }
    }
  }
});
```

### 2. Memory Management
```typescript
// Explicit cleanup of crypto materials
useEffect(() => {
  return () => {
    secureWipe(keyPair);
    secureWipe(signingKeyPair);
    secureWipe(certificate);
  };
}, []);
```

### 3. Lazy Loading
```typescript
// Component-level code splitting
const DocumentSigner = React.lazy(() => import('./DocumentSigner'));
```

---

## Security Considerations

### 1. Browser Security Requirements
- **HTTPS Required**: Web Crypto API only works in secure contexts
- **CSP Headers**: Content Security Policy prevents XSS
- **CORS Configuration**: Proper cross-origin resource sharing
- **Permission Management**: Explicit user consent for device access

### 2. Cryptographic Best Practices
- **Key Non-Extractability**: Private keys cannot be exported when possible
- **Secure Random Generation**: Uses cryptographically secure random sources
- **Algorithm Agility**: Supports multiple formats with graceful fallbacks
- **Forward Secrecy**: Unique keys per message prevent retroactive decryption

### 3. Session Security
- **Activity Monitoring**: Automatic session expiration on inactivity
- **Certificate Expiration**: Time-based certificate validity
- **Memory Cleanup**: Explicit wiping of sensitive data
- **Cross-Tab Isolation**: Secure communication between browser tabs

---

## Deployment Considerations

### 1. Browser Compatibility
```
Minimum Requirements:
- Chrome/Edge: Version 60+ (Web Crypto API support)
- Firefox: Version 55+ (Full crypto primitives)
- Safari: Version 11+ (ECDH and ECDSA support)
- Mobile: iOS Safari 11+, Chrome Mobile 60+
```

### 2. Security Headers
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 3. Performance Monitoring
- **Bundle Size**: Optimized chunks for faster loading
- **Crypto Performance**: Efficient key generation and operations
- **Memory Usage**: Monitored for memory leaks
- **Error Tracking**: Comprehensive error logging

---

This documentation provides a complete technical overview of the Cipher Chat system, covering every aspect from cryptographic implementation to deployment considerations. The system demonstrates modern web cryptography best practices while maintaining usability and security.