---
layout: 'work-page.njk'
pagination:
  data: collections.worksSortedRespectingOrder
  size: 1
  alias: work
permalink: '/works/{{ work.data.slug }}/'
eleventyExcludeFromCollections: true
---
