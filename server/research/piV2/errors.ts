export class ResearchSpecError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ResearchSpecError";
    this.code = code;
  }
}
