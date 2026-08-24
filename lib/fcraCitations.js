// lib/fcraCitations.js
//
// FCRA citation text, matched to the right recipient — this is the one
// piece of "elite quality" the constitution asks for that's actually a
// hard legal-accuracy requirement, not a taste call. Citations are general
// legal information about a well-established federal statute, not legal
// advice about any individual's situation; the standing disclosures and
// DisclaimerBar already carry that framing, this file just has to get the
// section numbers and what they actually require right.
//
//   §611 — 15 U.S.C. §1681i  (bureau reinvestigation duty)
//   §609 — 15 U.S.C. §1681g  (right to your own file — background, not a
//                             deletion-compelling citation; the "609
//                             letter" claiming otherwise is a common but
//                             legally overstated credit-repair-industry
//                             myth, deliberately not repeated here)
//   §623 — 15 U.S.C. §1681s-2 (furnisher responsibilities)

export const FCRA_CITATIONS = {
  bureau: {
    code: '15 U.S.C. §1681i (FCRA §611)',
    text: "Under 15 U.S.C. §1681i (FCRA §611), you are required to conduct a reasonable reinvestigation of any item I dispute, free of charge, generally within 30 days (45 days if I submit additional information during that period), and to delete or modify any item that cannot be verified as accurate.",
    mov: "Under §1681i(a)(7), I am also requesting a description of the procedure used to determine the accuracy of this information, including the business name, address, and telephone number of any furnisher contacted during your reinvestigation.",
  },
  secondary_bureau: {
    code: '15 U.S.C. §1681i (FCRA §611)',
    text: "As a consumer reporting agency, you are required under 15 U.S.C. §1681i (FCRA §611) to conduct a reasonable reinvestigation of any item I dispute, free of charge, generally within 30 days, and to delete or modify any item that cannot be verified as accurate.",
    mov: "Under §1681i(a)(7), I am also requesting a description of the procedure used to determine the accuracy of this information, including the business name, address, and telephone number of any furnisher contacted during your reinvestigation.",
  },
  furnisher: {
    code: '15 U.S.C. §1681s-2 (FCRA §623)',
    text: "Under 15 U.S.C. §1681s-2 (FCRA §623), you may not furnish information you know, or have reasonable cause to believe, is inaccurate, and you are required to conduct a reasonable investigation upon receiving a dispute of this kind directly from a consumer under §1681s-2(a)(8).",
    mov: null,
  },
};

// §609 is presented once, as background context in general education
// (the Report Walkthrough's "know your rights" section) — never as the
// operative citation inside a dispute letter itself.
export const SECTION_609_SUMMARY =
  "FCRA §609 (15 U.S.C. §1681g) gives you the right to request the actual contents of your file from a consumer reporting agency. It's the basis for pulling your own report — it doesn't, on its own, compel a bureau to delete anything; §611 is what does that once you've actually disputed an item.";

// The specific-failure citation used in Stage 4 CFPB/FTC escalation —
// "the prior letter went unanswered" and "verified without explanation"
// point at different provisions, so the complaint cites the one that
// actually matches what the client reports happened.
export const ESCALATION_FAILURE_CITATIONS = {
  no_response: {
    label: "No response within the required timeframe",
    text: "More than 30 days (45 if I submitted additional information) have passed since my dispute was received, with no reinvestigation result provided, as required by 15 U.S.C. §1681i(a)(1)(A).",
  },
  verified_without_explanation: {
    label: 'Verified the item without explaining how',
    text: "The item was reported as \"verified\" without any description of the reinvestigation procedure used, despite my request under 15 U.S.C. §1681i(a)(7) for the business name, address, and telephone number of any furnisher contacted.",
  },
  furnisher_ignored: {
    label: "Furnisher didn't investigate my direct dispute",
    text: "The furnisher did not conduct a reasonable investigation of my dispute submitted directly to them, as required by 15 U.S.C. §1681s-2(a)(8).",
  },
  other: {
    label: 'Something else (describe below)',
    text: null,
  },
};
