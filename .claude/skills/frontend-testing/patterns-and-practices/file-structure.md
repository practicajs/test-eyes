# Test File Structure

Tests live **next to the page they test** in a `test/` folder

```
src/pages/{PageName}/test
├── {PageName}.test.tsx   # Test cases only
├── actions.tsx                        # Render, navigate, click, verify helpers
├── factories.ts                       # Faker-based test data builders
├── httpMocks.ts                       # MSW handler setup functions
```
