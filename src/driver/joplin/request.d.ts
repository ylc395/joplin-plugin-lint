export interface LintRequest {
  event: 'lint';
  payload: {
    text: string;
  };
}
