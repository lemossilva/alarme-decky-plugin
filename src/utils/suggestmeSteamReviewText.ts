/** SuggestMe often includes Steam's positive-ratio figure inside the review summary string. Strip it for display. */
export function stripSteamReviewPercentFromDescription(raw: string): string {
    let s = raw
        .replace(/\(\s*\d{1,3}\s*%\s*\)/g, " ")
        .replace(/\b\d{1,3}\s*%/g, " ");
    s = s.replace(/\s{2,}/g, " ").trim();
    return s;
}
