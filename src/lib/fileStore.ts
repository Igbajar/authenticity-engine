// Simple module-level store to pass files between pages
let _pendingFile: File | null = null;

export function setPendingFile(file: File | null) {
  _pendingFile = file;
}

export function consumePendingFile(): File | null {
  const file = _pendingFile;
  _pendingFile = null;
  return file;
}
