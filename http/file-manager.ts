import { ImageMagick, IMagickImage, MagickFormat } from "../deps.ts";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "../deps.ts";

export abstract class FileService {
  abstract createThumbnail(file: File): Promise<string>;
  abstract uploadFile(file: File): Promise<string>;
  abstract deleteFile(url: string): Promise<void>;
}

export class S3FileService extends FileService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(s3Client: S3Client, bucketName: string) {
    super();
    this.s3Client = s3Client;
    this.bucketName = bucketName;
  }

  override async createThumbnail(file: File): Promise<string> {
    // Convert the file to a Uint8Array
    const fileBuffer = new Uint8Array(await file.arrayBuffer());

    let thumbnailBuffer;

    ImageMagick.read(fileBuffer, (image: IMagickImage) => {
      image.resize(500, 500);
      image.write(MagickFormat.Jpeg, (data: Uint8Array) => {
        thumbnailBuffer = data;
      });
    });

    const thumbnailKey = `thumbnails/${Date.now()}-${file.name.replace(
      /\.[^/.]+$/,
      ".jpg"
    )}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: thumbnailKey,
      Body: thumbnailBuffer,
      ContentType: "image/jpeg",
    });

    await this.s3Client.send(command);

    return `https://${this.bucketName}.s3.amazonaws.com/${thumbnailKey}`;
  }

  override async uploadFile(file: File): Promise<string> {
    const fileKey = `uploads/${Date.now()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: new Uint8Array(fileBuffer),
      ContentType: file.type,
    });

    await this.s3Client.send(command);

    return `https://${this.bucketName}.s3.amazonaws.com/${fileKey}`;
  }

  override async deleteFile(url: string): Promise<void> {
    const fileKey = url.split(".com/")[1]; // Extract the file key from the URL

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    await this.s3Client.send(command);
  }
}
