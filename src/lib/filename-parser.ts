export interface ParsedFileName {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
  cleanTitle: string;
}

export function parseFileName(fileName: string): ParsedFileName {
  // Remove extension
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  
  // Replace dots, underscores, and dashes with spaces
  let title = baseName.replace(/[\._\-]/g, " ");
  
  // Clean up common quality/codec/group tags (case insensitive)
  const tags = [
    /1080p/i, /720p/i, /480p/i, /2160p/i, /4k/i,
    /h\.?264/i, /h\.?265/i, /x264/i, /x265/i, /hevc/i,
    /bluray/i, /web-?dl/i, /webrip/i, /hdrip/i, /brrip/i,
    /aac/i, /ac3/i, /dts/i, /5\.1/i, /dual-?audio/i,
    /yify/i, /psa/i, /fgt/i, /rarbg/i, /multi/i
  ];
  
  tags.forEach(tag => {
    title = title.replace(tag, "");
  });

  // Extract year (4 digits after a space)
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : undefined;
  
  // Extract Season/Episode (S01E01, 1x01, etc.)
  const seMatch = title.match(/s(\d{1,2})e(\d{1,2})/i) || title.match(/(\d{1,2})x(\d{1,2})/i);
  const season = seMatch ? parseInt(seMatch[1]) : undefined;
  const episode = seMatch ? parseInt(seMatch[2]) : undefined;

  // Final clean up: Remove everything after the year or season/episode info
  let cleanTitle = title;
  
  if (seMatch) {
     cleanTitle = title.split(seMatch[0])[0];
  } else if (yearMatch) {
     cleanTitle = title.split(yearMatch[0])[0];
  }

  // Remove extra spaces and trim
  cleanTitle = cleanTitle.replace(/\s+/g, " ").trim();
  
  return {
    title: baseName,
    year,
    season,
    episode,
    cleanTitle
  };
}
