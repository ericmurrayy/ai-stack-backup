// Murray's FSM - Robots Configuration
// ======================================

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/book/*'],
        disallow: ['/api/', '/auth/', '/portal/', '/settings/'],
      },
    ],
  };
}
