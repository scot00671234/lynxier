
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Post } from "@/pages/Community";

interface CreatePostDialogProps {
  onPostCreated: (post: Post) => void;
}

export function CreatePostDialog({ onPostCreated }: CreatePostDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const navigate = useNavigate();

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Error",
        description: "Please enter both a title and content.",
        variant: "destructive",
      });
      return;
    }

    // Get the community name from URL
    const communityName = window.location.pathname.split('/').pop() || "";

    const newPost = {
      id: Date.now().toString(),
      title,
      content,
      community: communityName,
      votes: 0,
      comments: 0, // This is the comment count
      commentCount: 0, // This matches the Post page's schema
      author: "anonymous",
      comments: [] // This is the array of comments
    };

    // Save post to localStorage
    const storedPosts = localStorage.getItem('posts');
    const existingPosts = storedPosts ? JSON.parse(storedPosts) : {};
    existingPosts[newPost.id] = newPost;
    localStorage.setItem('posts', JSON.stringify(existingPosts));

    onPostCreated(newPost);
    setTitle("");
    setContent("");
    setOpen(false);

    toast({
      title: "Success",
      description: "Post created successfully!",
    });

    // Navigate to the new post
    navigate(`/post/${newPost.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a New Post</DialogTitle>
          <DialogDescription>
            Share your thoughts with the community
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="content" className="text-right">
              Content
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="col-span-3"
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
