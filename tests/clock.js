// How long a piece of work takes, for the tests that check it's done "in
// good time": the processor time this test's own process has used, in
// milliseconds, not the time on the wall. The test files run side by side,
// and other programs run beside them; on a busy machine the wall's time
// says how busy it is, not how much work growing a tree is. (Processor
// time is the work itself. It counts the helper threads too, so it can run
// a little over the wall's time on an idle machine: the limits have room.)
export function workNow() {
  const { user, system } = process.cpuUsage();
  return (user + system) / 1000;
}
