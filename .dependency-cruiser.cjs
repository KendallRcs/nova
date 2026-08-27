/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'hexagon-must-not-depend-on-adapters',
      severity: 'error',
      from: { path: '/hexagon/' },
      to: { path: '/adapters/' },
    },
    {
      name: 'domain-must-not-depend-on-application',
      severity: 'error',
      from: { path: '/hexagon/domain/' },
      to: { path: '/hexagon/application/' },
    },
    {
      name: 'hexagon-must-remain-framework-free',
      severity: 'error',
      from: { path: '/hexagon/' },
      to: {
        dependencyTypes: ['npm'],
        path: '^(?:@nestjs|@prisma|prisma|pg)(?:/|$)',
      },
    },
    {
      name: 'driving-adapters-must-not-use-driven-adapters',
      severity: 'error',
      from: { path: '/adapters/driving/' },
      to: { path: '/adapters/driven/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(?:^|/)(?:dist|coverage|generated|node_modules)(?:/|$)' },
    tsConfig: { fileName: 'tsconfig.dependency-cruiser.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['node', 'import', 'require', 'default'],
    },
  },
};
