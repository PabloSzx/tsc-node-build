export function build(options?: {
  project?: string;
  args?: string[];
  clean?: boolean;
  skipEsm?: boolean;
  skipCjs?: boolean;
  silent?: boolean;
}): Promise<void>;
export function watch(options?: {
  project?: string;
  onSuccess?: string;
  clean?: boolean;
  skipEsm?: boolean;
  skipCjs?: boolean;
}): Promise<void>;
