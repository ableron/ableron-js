class LoggerInterface {
  error(data: any, ...args: any) {}
  warn(data: any, ...args: any) {}
  info(data: any, ...args: any) {}
  debug(data: any, ...args: any) {}
}

class NoOpLogger extends LoggerInterface {}

export { LoggerInterface, NoOpLogger };
