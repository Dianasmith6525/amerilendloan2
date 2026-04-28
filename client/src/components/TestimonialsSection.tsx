import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  { name: "Sarah Mitchell", location: "Austin, TX", rating: 5, text: "I needed $3,200 for an emergency car repair and was dreading the process. Applied on a Monday morning, got approved by lunch, and the money hit my account that evening. The rate was lower than my credit union offered." },
  { name: "James Torres", location: "Phoenix, AZ", rating: 4, text: "Solid experience overall. The application was quick and I appreciated the clear breakdown of fees before I committed. My only gripe is the phone support hours — I work late shifts so it'd be nice to have evening availability. But the loan itself was exactly what I needed." },
  { name: "Maria Gonzalez", location: "Miami, FL", rating: 5, text: "I was really nervous because my credit isn't great (low 600s). AmeriLend still approved me for $5,000 at a rate I could actually manage. I've been making payments for 8 months now and it's been smooth. Already referred my sister." },
  { name: "David Robinson", location: "Seattle, WA", rating: 3, text: "The loan process was fine and funding was fast. I'm giving 3 stars because I wish the APR had been a bit lower — I qualified for 18.99% which is okay but not amazing. The customer service team was helpful when I had questions about my payment schedule though." },
  { name: "Jennifer Lin", location: "Chicago, IL", rating: 5, text: "Used AmeriLend to consolidate about $8,500 in credit card debt. Went from paying 24% across three cards down to one payment at 11.99%. The app is easy to use for tracking payments. Genuinely wish I'd done this sooner." },
  { name: "Brian Murphy", location: "San Antonio, TX", rating: 4, text: "Applied for $2,000 for some plumbing work at the house. Got approved same day which was great. Took until the next business day for the deposit though, not same-day like I expected. Otherwise no complaints — terms were clear and the monthly payment fits my budget." },
  { name: "Amanda Stevens", location: "Portland, OR", rating: 4, text: "Approved for $6,000 even with a couple old collections on my report. The interest rate was fair given my situation. I do wish there were more repayment term options — 36 months was the max and I would have preferred 48. But overall a positive experience." },
  { name: "Marcus Williams", location: "Denver, CO", rating: 5, text: "Second time borrowing from AmeriLend. First loan was for $4,000, paid it off early with no penalty. Just took out another for $7,500 for a home renovation. The repeat customer process was even faster. These guys are legit." },
];

export default function TestimonialsSection() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      const container = scrollContainerRef.current;
      
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0A2540] mb-4">
            What Our Customers Say
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Join thousands of satisfied customers who trust AmeriLend for their financial needs
          </p>
        </div>

        <div className="relative">
          {/* Navigation Buttons */}
          <Button
            onClick={() => scroll('left')}
            variant="outline"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white shadow-lg hover:bg-gray-50 rounded-full w-12 h-12 hidden md:flex"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <Button
            onClick={() => scroll('right')}
            variant="outline"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white shadow-lg hover:bg-gray-50 rounded-full w-12 h-12 hidden md:flex"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>

          {/* Scrollable Container */}
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto scroll-smooth hide-scrollbar px-4 md:px-12"
          >
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="flex-shrink-0 w-[350px] hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  {/* Rating Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-5 h-5 ${i < testimonial.rating ? 'fill-[#FFA500] text-[#FFA500]' : 'text-gray-300'}`} />
                    ))}
                  </div>

                  {/* Review Text */}
                  <p className="text-gray-700 mb-6 min-h-[100px] italic">
                    "{testimonial.text}"
                  </p>

                  {/* Customer Info */}
                  <div className="border-t pt-4">
                    <p className="font-semibold text-[#0A2540]">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.location}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Mobile scroll hint */}
          <div className="flex justify-center gap-2 mt-6 md:hidden">
            <Button
              onClick={() => scroll('left')}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              onClick={() => scroll('right')}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>


      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  );
}
