export interface LintRequest {
  event: 'lint';
  payload: {
    text: string;
  };
}

export interface LoadConfigsRequest {
  event: 'loadConfigs';
}
