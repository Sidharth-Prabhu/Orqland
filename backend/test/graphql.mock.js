module.exports = {
  GqlExecutionContext: {
    create: (context) => ({
      getContext: () => {
        try {
          return { req: context.switchToHttp().getRequest() };
        } catch {
          return {};
        }
      },
      getArgs: () => ({}),
    }),
  },
  Resolver: () => () => {},
  Query: () => () => {},
  Mutation: () => () => {},
  Subscription: () => () => {},
  Args: () => () => {},
  Context: () => () => {},
  ObjectType: () => () => {},
  InputType: () => () => {},
  InterfaceType: () => () => {},
  UnionType: () => () => {},
  Field: () => () => {},
  ID: String,
  Int: Number,
  Float: Number,
  GraphQLModule: {
    forRootAsync: () => ({
      module: class MockGraphQLModule {},
      providers: [],
      exports: [],
    }),
    forRoot: () => ({
      module: class MockGraphQLModule {},
      providers: [],
      exports: [],
    }),
  },
};
