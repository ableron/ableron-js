export class Fragment {
  readonly content: string;
  readonly expirationTime: Date;
  readonly isRemote: boolean;
  readonly statusCode: number;
  readonly responseHeaders: Map<string, string[]>;

  constructor(
    statusCode: number,
    content: string,
    url?: string,
    expirationTime?: Date,
    responseHeaders?: Map<string, string[]>
  ) {
    this.statusCode = statusCode;
    this.content = content;
    this.isRemote = url !== undefined;
    this.expirationTime = expirationTime !== undefined ? expirationTime : new Date(0);
    this.responseHeaders = responseHeaders !== undefined ? responseHeaders : new Map();
  }
}
