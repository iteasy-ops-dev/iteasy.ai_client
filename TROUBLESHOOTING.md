# Troubleshooting Guide

## Hydration Mismatch Issues

If you encounter hydration mismatch errors, here are the steps I've taken to fix them:

### 1. **Fixed Zustand Persist**
- Added `skipHydration: true` to persist configuration
- Created custom storage that checks for `typeof window !== 'undefined'`
- Manual rehydration trigger in component

### 2. **Added Client-Side Hydration Check**
- Created `useHydration` hook to detect client-side mounting
- Added loading state until hydration completes
- Prevents server/client mismatch during initial render

### 3. **Consistent Date Handling**
- All dates are serialized to ISO strings for storage
- Dates are properly reconstructed during rehydration
- Optional `createdAt` field to handle undefined dates

## Common Issues & Solutions

### Hydration Mismatch
**Error**: "Hydration failed because the server rendered HTML didn't match the client"

**Solution**: The app now includes hydration guards that:
- Show loading state until client-side JavaScript loads
- Prevent zustand from hydrating during SSR
- Ensure consistent rendering between server and client

### Environment Variables
**Issue**: OpenAI API calls failing

**Solution**: 
1. Copy `.env.example` to `.env.local`
2. Add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```

### Port Issues
**Issue**: Port 3000 already in use

**Solution**: Next.js automatically finds the next available port (3001, 3002, etc.)

## Performance Tips

1. **Markdown Rendering**: Components are memoized to prevent unnecessary re-renders
2. **Message History**: Large conversations are efficiently handled with proper scrolling
3. **State Management**: Zustand provides minimal re-renders with selective subscriptions

## Development Commands

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Type checking
npx tsc --noEmit
```