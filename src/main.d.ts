export function build(options?: {
  project?: string;
  args?: string[];
  clean?: boolean;
}): Promise<void>;
export function watch(options?: {
  project?: string;
  onSuccess?: string;
  clean?: boolean;
}): Promise<void>;
