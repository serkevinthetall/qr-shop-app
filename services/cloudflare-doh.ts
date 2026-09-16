/**
 * Warm Cloudflare DoH from JS using the literal IP https://1.1.1.1
 * (no Atom DNS required for this call). Updates nothing native by itself —
 * proves 1.1.1.1 is reachable and primes HTTP connections before API calls.
 */
export async function warmCloudflareDoh(hostname: string): Promise<string[]> {
  const name = hostname.replace(/^https?:\/\//, '').split('/')[0]?.split(':')[0] ?? hostname;

  try {
    const response = await fetch(
      `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=A`,
      {
        method: 'GET',
        headers: { accept: 'application/dns-json' },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as {
      Status?: number;
      Answer?: Array<{ type?: number; data?: string }>;
    };

    if (data.Status !== 0 || !Array.isArray(data.Answer)) {
      return [];
    }

    return data.Answer.filter((row) => row.type === 1 && typeof row.data === 'string').map(
      (row) => row.data as string,
    );
  } catch {
    return [];
  }
}
