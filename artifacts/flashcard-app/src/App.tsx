import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import FlashcardApp from "./pages/FlashcardApp";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FlashcardApp />
    </QueryClientProvider>
  );
}

export default App;
