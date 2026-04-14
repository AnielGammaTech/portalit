export function createPageUrl(pageName: string): string {
  if (!pageName) return '/';
  return '/' + pageName.replace(/ /g, '-');
}