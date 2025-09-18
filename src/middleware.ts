import { stargazerCount } from '@utils/github';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

interface Context {
  locals: {
    starCount?: string;
  };
  request: Request;
}

type NextFunction = () => Promise<Response>;

export async function onRequest(context: Context, next: NextFunction) {
  const starCount = await stargazerCount('datum-cloud', 'datum');
  const formatter = new Intl.NumberFormat('en-US', { notation: 'compact' });
  const formattedStarCount = formatter.format(starCount);

  context.locals.starCount = formattedStarCount;

  // Get the response from the next handler
  const response = await next();

  // Check if client accepts gzip compression
  const acceptEncoding = context.request.headers.get('accept-encoding') || '';
  const supportsGzip = acceptEncoding.includes('gzip');

  // Only compress HTML responses and if client supports gzip
  const contentType = response.headers.get('content-type') || '';

  const shouldCompress =
    supportsGzip &&
    (contentType.includes('text/html') ||
      contentType.includes('text/css') ||
      contentType.includes('application/javascript') ||
      contentType.includes('application/json'));

  if (!shouldCompress || response.headers.get('content-encoding')) {
    return response;
  }

  try {
    // Get response body
    const body = await response.text();

    // Compress the body
    const compressedBody = await gzipAsync(body);

    // Create new response with compressed body and appropriate headers
    return new Response(new Uint8Array(compressedBody), {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        'content-encoding': 'gzip',
        vary: 'Accept-Encoding',
        'content-length': compressedBody.length.toString(),
      },
    });
  } catch (error) {
    console.error('Compression error:', error);
    return response;
  }
}
