import { singleFileUpload } from './uploadFile';

/** Upload assignment submission: JPG/PNG/WebP or PDF up to 10 MB */
const uploadAssignment = (field: string = 'file') => singleFileUpload(field, {
  types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  maxBytes: 10 * 1024 * 1024,
  typeMessage: 'Upload a JPG, PNG, WebP image or PDF document',
  sizeMessage: 'The file must be 10 MB or smaller',
});

export default uploadAssignment;
