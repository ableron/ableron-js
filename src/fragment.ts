export default class Fragment {
  readonly content: string;
  readonly expirationTime: Date;
  readonly url?: string;
  readonly statusCode: number;
  readonly responseHeaders: Headers;

  constructor(statusCode: number, content: string, url?: string, expirationTime?: Date, responseHeaders?: Headers) {
    this.statusCode = statusCode;
    this.content = content;
    this.url = url;
    this.expirationTime = expirationTime || new Date(0);
    this.responseHeaders = responseHeaders || new Headers();
  }
}
