
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import Community from "./pages/Community";
import Post from "./pages/Post";
import NotFound from "./pages/NotFound";
import type { Post as PostType } from "./pages/Community";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
    },
  },
});

const App = () => {
  const [posts, setPosts] = useState<{ [key: string]: PostType[] }>({});

  const handleNewPost = (post: PostType) => {
    setPosts(prevPosts => ({
      ...prevPosts,
      [post.community]: [...(prevPosts[post.community] || []), post]
    }));
  };

  // Preload community data
  useEffect(() => {
    const fetchCommunityPosts = async (community: string) => {
      try {
        const response = await fetch(`/api/communities/${community}/posts`);
        
        if (!response.ok) {
          console.error(`Failed to fetch posts for ${community}`);
          return;
        }
        
        const communityPosts = await response.json();
        
        // Transform to match PostType
        const transformedPosts: PostType[] = communityPosts.map((post: any) => ({
          title: post.title,
          content: post.content,
          community: post.community,
          votes: post.votes,
          comments: 0 // This will be loaded separately when viewing the post
        }));
        
        setPosts(prevPosts => ({
          ...prevPosts,
          [community]: transformedPosts
        }));
      } catch (error) {
        console.error(`Error fetching ${community} posts:`, error);
      }
    };

    // Fetch posts for default communities
    const defaultCommunities = [
      'philosophy', 'technology', 'community', 'science', 
      'art', 'law', 'medicine', 'education'
    ];
    
    defaultCommunities.forEach(community => {
      fetchCommunityPosts(community);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route 
                path="/community/:communityName" 
                element={<Community 
                  posts={posts} 
                  onPostCreated={handleNewPost} 
                />} 
              />
              <Route path="/post/:postId" element={<Post />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
