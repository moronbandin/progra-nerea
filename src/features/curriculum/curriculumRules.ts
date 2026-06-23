import criteria from "../../data/curriculum/assessment-criteria.json";
import contents from "../../data/curriculum/contents.json";
import type { CurriculumItem } from "../../schemas/domain";

const criterionItems = criteria as CurriculumItem[];
const contentItems = contents as CurriculumItem[];

export function criterionBlockNumber(code: string): string | undefined {
  return code.match(/^CE(\d+)\./i)?.[1];
}

export function contentBlockNumber(blockId?: string): string | undefined {
  return blockId?.match(/block-(\d+)/i)?.[1];
}

export function allowedContentBlocks(criterionIds: string[]): Set<string> {
  const selected = new Set(criterionIds);
  return new Set(
    criterionItems
      .filter((item) => selected.has(item.id))
      .map((item) => criterionBlockNumber(item.code))
      .filter((block): block is string => Boolean(block))
  );
}

export function filterContentIdsByCriteria(contentIds: string[], criterionIds: string[]): string[] {
  const allowed = allowedContentBlocks(criterionIds);
  const selected = new Set(contentIds);
  return contentItems
    .filter((item) => selected.has(item.id) && allowed.has(contentBlockNumber(item.blockId) ?? ""))
    .map((item) => item.id);
}

