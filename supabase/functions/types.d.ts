declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: {
    global?: { headers?: Record<string, string> };
    auth?: { persistSession?: boolean; autoRefreshToken?: boolean };
  }): any;
}

declare module 'npm:pdf-parse@1.1.1' {
  const parsePdf: (data: Uint8Array) => Promise<{ text: string }>;
  export default parsePdf;
}

declare module 'node:buffer' {
  export const Buffer: {
    from(data: ArrayBuffer): Uint8Array;
  };
}
