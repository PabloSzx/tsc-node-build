export function build(project?: string, args?:string[]): Promise<void>;
export function watch(options?: {
    project?: string;
    onSuccess?: string;
}): Promise<void>;
