// Address normalization utilities

export const normalizeAddress = (address) => {
  if (!address) return null;

  // Fix state codes like "N J" -> "NJ"
  address = address.replace(/\b([A-Z])\s+([A-Z])\b/g, '$1$2');

  // Fix zip codes like "07302- 6475" -> "07302-6475"
  address = address.replace(/(\d{5})\s*-\s*(\d{4})/g, '$1-$2');

  // Add space between digit and letter
  address = address.replace(/(\d)([A-Za-z])/g, '$1 $2');
  // Add space between letter and digit
  address = address.replace(/([A-Za-z])(\d)/g, '$1 $2');

  // Normalize whitespace first
  address = address.replace(/\s+/g, ' ').trim();

  // Convert to title case
  address = address.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

  // Fix common abbreviations that should stay uppercase
  address = address.replace(/\bNj\b/g, 'NJ');
  address = address.replace(/\bNy\b/g, 'NY');
  address = address.replace(/\bPa\b/g, 'PA');
  address = address.replace(/\bCt\b/g, 'CT');
  address = address.replace(/\bMa\b/g, 'MA');

  // Fix street direction abbreviations (N, S, E, W, NE, NW, SE, SW)
  address = address.replace(/\b(N|S|E|W|Ne|Nw|Se|Sw)\b/g, match => match.toUpperCase());

  return address;
};
