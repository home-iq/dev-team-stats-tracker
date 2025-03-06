import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Define the form schema with validation
const formSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
});

type FormValues = z.infer<typeof formSchema>;

const TestSdr = () => {
  // Get stored values from localStorage if they exist
  const getStoredValues = (): Partial<FormValues> => {
    const storedValues = localStorage.getItem("test-sdr-form");
    return storedValues ? JSON.parse(storedValues) : {};
  };

  // Initialize form with default values from localStorage
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getStoredValues(),
  });

  // Save form values to localStorage whenever they change
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (Object.keys(values).length > 0) {
        localStorage.setItem("test-sdr-form", JSON.stringify(values));
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch(
        "https://myhomeiq-n8n.smallmighty.co/webhook/47c85ca6-d84d-4ae1-889d-501607d61e14",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        toast.success(result.message || "Form submitted successfully", {
          duration: 3000,
        });
      } else {
        toast.error("Failed to submit form");
      }
    } catch (error) {
      toast.error("An error occurred while submitting the form");
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-md mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Test SDR</h1>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john.doe@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1234567890" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default TestSdr; 