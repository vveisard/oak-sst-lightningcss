/**
 * (Oak)[https://deno.land/x/oak] middleware for just-in-time server-side transformation (SST) of CSS using [Lightning CSS](https://lightningcss.dev/).
 * 
 * @module
 */

import {
  convertBodyToBodyInit,
  type Middleware,
  transform,
  type TransformOptions,
  join
} from "./deps.ts";

// @region-begin

interface MiddlewareOptions {
  readonly absoluteRootDirPath: string
  readonly transformOptions: Omit<TransformOptions<Record<string, never>>, "code" | "filename" | "projectRoot">,
}

const cssMimeTypes = new Set<string | undefined>(
  [".css", "text/css"],
);

/**
 * Create Oak middleware which transforms CSS files using Lightning CSS before serving.
 * @param options `cssModules: false` disables css modules, even when extension is `module.css`.
 */
const createSstLightningCSSMiddleware = (
  options: MiddlewareOptions
): Middleware => {
  const encoder = new TextEncoder();

  return async (ctx, next) => {
    await next();

    if (
      !cssMimeTypes.has(ctx.response.type)
    ) {
      return;
    }

    const isFileCssModule = ctx.request.url.pathname.split(".").at(-2) === "module";

    const absoluteSourceFilePath = join(
      options.absoluteRootDirPath,
      `.${ctx.request.url.pathname}`
    )

    if (ctx.response.body == null) {
      // skip
    } else if (typeof ctx.response.body === "string") {
      // major fast path
      const css = ctx.response.body;
      const result = transform(
        {
          ...options,
          code: encoder.encode(css),
          projectRoot: options.absoluteRootDirPath,
          filename: absoluteSourceFilePath,
          cssModules: (
            isFileCssModule && 
            options.transformOptions.cssModules !== false
          ),
        },
      );
      ctx.response.body = result?.code;
    } else if (ctx.response.body instanceof Uint8Array) {
      // major fast path
      const css = ctx.response.body;
      const result = transform(
        {
          ...options,
          code: css,
          projectRoot: options.absoluteRootDirPath,
          filename: absoluteSourceFilePath,
          cssModules: (
            isFileCssModule && 
            options.transformOptions.cssModules !== false
          ),
        },
      );
      ctx.response.body = result?.code;
    } else {
      // fallback

      const [responseInit] = await convertBodyToBodyInit(ctx.response.body);
      const css = await new Response(responseInit).text();
      const result = transform(
        {
          ...options,
          code: encoder.encode(css),
          projectRoot: options.absoluteRootDirPath,
          filename: absoluteSourceFilePath,
          cssModules: (
            isFileCssModule && 
            options.transformOptions.cssModules !== false
          ),
        },
      );
      ctx.response.body = result?.code;
    }

    ctx.response.type = "text/css";
  };
};

export { createSstLightningCSSMiddleware };

// @region-end
