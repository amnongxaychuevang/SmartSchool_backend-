import { singleFileUpload } from './uploadFile';

/** One JPG/PNG/WebP up to 5 MB (re-encoded by sharp before it is stored). */
const uploadImage = (field: string) => singleFileUpload(field, {
  types: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 5 * 1024 * 1024,
  typeMessage: 'Upload a JPG, PNG or WebP image',
  sizeMessage: 'The image must be 5 MB or smaller',
});

export default uploadImage;
