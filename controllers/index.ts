import { OAuth2Client, S3Client } from "../deps.ts";
import { S3FileService } from "../http/file-manager.ts";
import ProductRepository from "../repository/product.ts";
import UserRepository from "../repository/user.ts";
import { AuthController } from "./auth/index.ts";
import { ProductsController } from "./products/index.ts";

export interface Route {
  method: "GET" | "POST" | "PUT" | "DELETE";
  handler: () => void;
}

const clientID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
const redirectURI = Deno.env.get("GOOGLE_REDIRECT_URL") || "";

if (!clientID || !clientSecret || !redirectURI) {
  throw new Error(
    "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URL must be provided"
  );
}

// Initialize the OAuth2 client
const oauth2Client = new OAuth2Client({
  clientId: clientID,
  clientSecret: clientSecret,
  authorizationEndpointUri: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUri: "https://oauth2.googleapis.com/token",
  redirectUri: redirectURI,
  defaults: {
    scope: ["openid", "email", "profile"],
  },
});

const s3Client = new S3Client({
  region: Deno.env.get("AWS_REGION") || "eu-central-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});

const BUCKET_NAME = Deno.env.get("AWS_S3_BUCKET_NAME")!;

export const fileService = new S3FileService(s3Client, BUCKET_NAME);

const userRepository = new UserRepository();
const productRepository = new ProductRepository();

const authController = new AuthController(oauth2Client, userRepository);
const productsController = new ProductsController(productRepository);

export { authController, productsController };
