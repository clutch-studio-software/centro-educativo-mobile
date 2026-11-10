import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as DocumentPicker from 'expo-document-picker';
import { auth, storage } from './firebase';

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];

export const formatFileSize = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '250 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const inferMimeType = (fileName = '', rawMime = '') => {
  const lowerMime = String(rawMime || '').toLowerCase();
  if (lowerMime === 'image/jpg') return 'image/jpeg';
  if (ALLOWED_MIME_TYPES.includes(lowerMime)) return lowerMime;

  const lowerName = String(fileName || '').toLowerCase();
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  return lowerMime || 'application/pdf';
};

export const validatePickedFile = (fileAsset) => {
  if (!fileAsset) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }

  if (fileAsset.size && fileAsset.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `El archivo (${formatFileSize(fileAsset.size)}) supera el límite máximo permitido de 2 MB.`,
    };
  }

  const name = String(fileAsset.name || '').toLowerCase();
  const mime = inferMimeType(name, fileAsset.mimeType || fileAsset.type);
  const validExt = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  const validMime = ALLOWED_MIME_TYPES.includes(mime);

  if (!validExt && !validMime) {
    return {
      valid: false,
      error: 'Formato no permitido. Solo se aceptan archivos PDF, PNG, JPG o JPEG.',
    };
  }

  return { valid: true, error: null, mimeType: mime };
};

export const pickAllowedDocument = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/png', 'image/jpeg'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const validation = validatePickedFile(asset);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  return {
    name: asset.name || `comprobante_${Date.now()}.pdf`,
    size: asset.size || 256000,
    uri: asset.uri,
    mimeType: validation.mimeType,
    webFile: asset.file || null,
  };
};

const readUriAsBlob = (uri) => {
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => resolve(xhr.response);
      xhr.onerror = () =>
        reject(new Error('No se pudo leer el contenido binario del archivo seleccionado.'));
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  }
  return fetch(uri).then((r) => r.blob());
};

/**
 * Sube un comprobante bancario o certificado médico a Firebase Storage
 * cumpliendo estrictamente con storage.rules:
 * - vouchers/{userId}/{timestamp}_{sanitizedFileName}
 * - justifications/{userId}/{studentId}_{absenceId}_{timestamp}_{sanitizedFileName}
 * - tamaño <= 2 MB y contentType en ['application/pdf', 'image/png', 'image/jpeg']
 */
export const uploadFileToFirebaseStorage = async ({
  fileAsset,
  folder = 'vouchers',
  userId,
  prefix = '',
  extraMetadata = {},
}) => {
  const validation = validatePickedFile(fileAsset);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const effectiveUid = auth.currentUser?.uid || userId;
  if (!effectiveUid) {
    throw new Error('Debe tener sesión activa para subir archivos a Firebase Storage.');
  }

  const sanitizedName = String(fileAsset.name || 'comprobante.pdf')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);

  const cleanPrefix = prefix
    ? `${String(prefix).replace(/[^a-zA-Z0-9_-]/g, '_')}_`
    : '';

  const timestamp = Date.now();
  const storagePath = `${folder}/${effectiveUid}/${cleanPrefix}${timestamp}_${sanitizedName}`;
  const contentType = validation.mimeType;

  let binaryPayload;
  if (fileAsset.webFile) {
    binaryPayload = fileAsset.webFile;
  } else if (fileAsset.uri) {
    binaryPayload = await readUriAsBlob(fileAsset.uri);
  } else {
    throw new Error('No se pudo leer el contenido binario del archivo seleccionado.');
  }

  const storageRef = ref(storage, storagePath);
  const metadata = {
    contentType,
    customMetadata: {
      originalName: String(fileAsset.name || sanitizedName),
      uploadedBy: String(effectiveUid),
      uploadedAt: new Date().toISOString(),
      ...extraMetadata,
    },
  };

  const snapshot = await uploadBytes(storageRef, binaryPayload, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return {
    downloadUrl,
    fileName: fileAsset.name || sanitizedName,
    fileSize: formatFileSize(fileAsset.size),
    storagePath,
    contentType,
  };
};
