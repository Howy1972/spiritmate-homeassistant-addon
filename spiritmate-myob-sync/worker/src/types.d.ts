declare module 'pdf-parse' {
  const pdfParse: {
    default: (dataBuffer: Buffer, options?: any) => Promise<{
      numpages: number;
      numrender: number;
      info: any;
      metadata: any;
      text: string;
      version: string;
    }>;
  };
  export = pdfParse;
}

declare module 'multer';

