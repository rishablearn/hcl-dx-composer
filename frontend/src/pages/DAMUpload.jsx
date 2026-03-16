import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { damApi } from '../services/api';
import {
  Upload,
  X,
  Image,
  FileVideo,
  FileAudio,
  File,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

function getFileIcon(mimeType) {
  if (mimeType?.startsWith('image/')) return Image;
  if (mimeType?.startsWith('video/')) return FileVideo;
  if (mimeType?.startsWith('audio/')) return FileAudio;
  return File;
}

function FilePreview({ file, onRemove, status, progress }) {
  const FileIcon = getFileIcon(file.type);
  const isImage = file.type?.startsWith('image/');

  return (
    <div className={clsx(
      'card p-4 flex items-center gap-4',
      status === 'error' && 'border-error-200 bg-error-50',
      status === 'success' && 'border-success-200 bg-success-50'
    )}>
      {/* Preview */}
      <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center overflow-hidden flex-shrink-0">
        {isImage && file.preview ? (
          <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <FileIcon className="w-8 h-8 text-neutral-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-navy-800 truncate">{file.name}</p>
        <p className="text-sm text-neutral-500">
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
        
        {/* Progress bar */}
        {status === 'uploading' && (
          <div className="mt-2 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-secondary-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0">
        {status === 'uploading' && (
          <Loader2 className="w-5 h-5 text-secondary-500 animate-spin" />
        )}
        {status === 'success' && (
          <CheckCircle className="w-5 h-5 text-success-500" />
        )}
        {status === 'error' && (
          <AlertCircle className="w-5 h-5 text-error-500" />
        )}
        {!status && (
          <button
            onClick={() => onRemove(file)}
            className="p-1 hover:bg-neutral-100 rounded"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function DAMUpload() {
  const navigate = useNavigate();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => Object.assign(file, {
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      id: `${file.name}-${Date.now()}`
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg', '.tiff'],
      'video/*': ['.mp4', '.webm', '.mov'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'application/pdf': ['.pdf']
    },
    maxSize: 52428800, // 50MB
    multiple: true
  });

  const removeFile = (fileToRemove) => {
    setFiles(prev => prev.filter(f => f.id !== fileToRemove.id));
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      setUploadStatus(prev => ({ ...prev, [file.id]: 'uploading' }));
      setUploadProgress(prev => ({ ...prev, [file.id]: 0 }));

      const formData = new FormData();
      formData.append('file', file);

      try {
        await damApi.uploadAsset(formData, (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(prev => ({ ...prev, [file.id]: percent }));
        });

        setUploadStatus(prev => ({ ...prev, [file.id]: 'success' }));
        successCount++;
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadStatus(prev => ({ ...prev, [file.id]: 'error' }));
        errorCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} file(s) failed to upload`);
    }

    // Navigate to DAM workflow after successful upload
    if (successCount > 0 && errorCount === 0) {
      setTimeout(() => navigate('/dam'), 1500);
    }
  };

  const handleSubmitForApproval = async () => {
    toast.success('Assets submitted for approval');
    navigate('/dam');
  };

  const allUploaded = files.length > 0 && files.every(f => uploadStatus[f.id] === 'success');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-navy-800">Upload Assets</h1>
        <p className="text-neutral-500 mt-1">
          Upload images and media files to the DAM staging area
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'card border-2 border-dashed p-12 text-center cursor-pointer transition-colors',
          isDragActive ? 'border-secondary-500 bg-secondary-50' : 'border-neutral-200 hover:border-secondary-300'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center">
          <div className={clsx(
            'w-16 h-16 rounded-full flex items-center justify-center mb-4',
            isDragActive ? 'bg-secondary-100' : 'bg-neutral-100'
          )}>
            <Upload className={clsx(
              'w-8 h-8',
              isDragActive ? 'text-secondary-500' : 'text-neutral-400'
            )} />
          </div>
          <p className="text-lg font-medium text-navy-800">
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-neutral-500 mt-1">
            or click to browse
          </p>
          <p className="text-sm text-neutral-400 mt-4">
            Supports: JPG, PNG, GIF, WebP, SVG, MP4, WebM, MP3, PDF (max 50MB)
          </p>
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy-800">
              Selected Files ({files.length})
            </h2>
            {!uploading && !allUploaded && (
              <button
                onClick={() => setFiles([])}
                className="text-sm text-neutral-500 hover:text-error-500"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-3">
            {files.map(file => (
              <FilePreview
                key={file.id}
                file={file}
                onRemove={removeFile}
                status={uploadStatus[file.id]}
                progress={uploadProgress[file.id]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => navigate('/dam')}
            className="btn-ghost"
            disabled={uploading}
          >
            Cancel
          </button>
          
          {allUploaded ? (
            <button
              onClick={handleSubmitForApproval}
              className="btn-secondary"
            >
              Submit for Approval
            </button>
          ) : (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Files
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
