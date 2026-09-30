/**
 * The Pentagonal Thesis™ on the landing page: the five-question product story
 * followed by one worked example. Self-contained in
 * client/src/components/landing/thesis/ so it composes with the marketing
 * page's background, tickers and seismic underlay without touching them.
 */
import ThesisSection from "./thesis/ThesisSection";
import WorkedExample from "./thesis/WorkedExample";

export { THESIS_QUESTIONS, THESIS_CLOSING, THESIS_INTRO } from "./thesis/thesisContent";

export default function PentagonalThesis() {
  return (
    <>
      <ThesisSection />
      <WorkedExample />
    </>
  );
}
