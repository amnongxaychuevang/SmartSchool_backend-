import { singleFileUpload } from './uploadFile';

/** One PDF up to 10 MB (its "%PDF-" signature is checked again before it is stored). */
const uploadPdf = (field: string) => singleFileUpload(field, {
  types: ['application/pdf'],
  maxBytes: 10 * 1024 * 1024,
  typeMessage: 'Upload a PDF file',
  sizeMessage: 'The PDF must be 10 MB or smaller',
});

export default uploadPdf;
