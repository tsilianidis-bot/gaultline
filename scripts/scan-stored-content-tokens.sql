-- Read-only scan for trade-class tokens in stored customer content.
-- Run this against a restored backup before a deploy. Do not run it against production.
-- It does not UPDATE, DELETE, INSERT, or ALTER. A non-empty result means that row
-- still contains a denied token and must be neutralized before the deploy.

SELECT 'blogPosts' AS source_table, id, slug AS locator
FROM blogPosts
WHERE CONCAT_WS(' ', title, subtitle, content, metaTitle, metaDescription, tags) REGEXP '[[:<:]](STRONG BUY|BUY NOW|STRONG SELL|STRONG REDUCE|BUY|SELL|HOLD|WATCH|WAIT|ADD GRADUALLY|ACCUMULATE|ACQUIRE|AVOID|OVERWEIGHT|UNDERWEIGHT|PASS OVER|REDUCE|TRIM|ADD)[[:>:]]'
UNION ALL
SELECT 'organicContent', id, slug
FROM organicContent
WHERE CONCAT_WS(' ', title, metaDescription, content, schemaJson, internalLinksJson) REGEXP '[[:<:]](STRONG BUY|BUY NOW|STRONG SELL|STRONG REDUCE|BUY|SELL|HOLD|WATCH|WAIT|ADD GRADUALLY|ACCUMULATE|ACQUIRE|AVOID|OVERWEIGHT|UNDERWEIGHT|PASS OVER|REDUCE|TRIM|ADD)[[:>:]]'
UNION ALL
SELECT 'xPostQueue', id, COALESCE(xPostId, variant)
FROM xPostQueue
WHERE CONCAT_WS(' ', content, headline) REGEXP '[[:<:]](STRONG BUY|BUY NOW|STRONG SELL|STRONG REDUCE|BUY|SELL|HOLD|WATCH|WAIT|ADD GRADUALLY|ACCUMULATE|ACQUIRE|AVOID|OVERWEIGHT|UNDERWEIGHT|PASS OVER|REDUCE|TRIM|ADD)[[:>:]]'
UNION ALL
SELECT 'dailyBriefSnapshots', id, snapshotId
FROM dailyBriefSnapshots
WHERE CONCAT_WS(' ', snapshotJson, validationJson, warningsJson) REGEXP '[[:<:]](STRONG BUY|BUY NOW|STRONG SELL|STRONG REDUCE|BUY|SELL|HOLD|WATCH|WAIT|ADD GRADUALLY|ACCUMULATE|ACQUIRE|AVOID|OVERWEIGHT|UNDERWEIGHT|PASS OVER|REDUCE|TRIM|ADD)[[:>:]]'
UNION ALL
SELECT 'signalPages', id, symbol
FROM signalPages
WHERE CONCAT_WS(' ', signalLabel, name) REGEXP '[[:<:]](STRONG BUY|BUY NOW|STRONG SELL|STRONG REDUCE|BUY|SELL|HOLD|WATCH|WAIT|ADD GRADUALLY|ACCUMULATE|ACQUIRE|AVOID|OVERWEIGHT|UNDERWEIGHT|PASS OVER|REDUCE|TRIM|ADD)[[:>:]]';
