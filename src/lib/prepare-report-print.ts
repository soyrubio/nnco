/** Wait for the assets used by the existing report before opening browser print. */
export async function prepareReportPrint(report: HTMLElement): Promise<void> {
  await Promise.all([
    report.ownerDocument.fonts.ready,
    ...Array.from(report.querySelectorAll("img"), (image) => image.decode()),
  ]);
}
