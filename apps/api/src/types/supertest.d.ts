declare module "supertest" {
  import type { Express } from "express";

  type TestResponse = {
    status: number;
    headers: Record<string, string | string[] | undefined>;
    body: {
      error?: {
        code?: string;
      };
      [key: string]: unknown;
    };
  };

  type TestRequest = Promise<TestResponse> & {
    set(name: string, value: string | string[]): TestRequest;
    send(body: unknown): TestRequest;
  };

  type TestAgent = {
    get(path: string): TestRequest;
    post(path: string): TestRequest;
  };

  export default function request(app: Express): TestAgent;
}
