export function green(text: string): string {
  return `\x1b[37;42m${text}\x1b[0m`;
}

export function yellow(text: string): string {
  return `\x1b[37;43m${text}\x1b[0m`;
}

export function cyan(text: string): string {
  return `\x1b[37;46m${text}\x1b[0m`;
}

export function red(text: string): string {
  return `\x1b[37;41m${text}\x1b[0m`;
}

export function magenta(text: string): string {
  return `\x1b[37;45m${text}\x1b[0m`;
}
