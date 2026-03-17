import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  { name: "Sarah M.", location: "Austin, TX", rating: 5, text: "AmeriLend saved me when I needed emergency car repairs. I paid the small processing fee with my credit card and got my loan the next day!" },
  { name: "James T.", location: "Phoenix, AZ", rating: 5, text: "Best lending experience I've ever had. Paid the processing fee via crypto, and funds were disbursed within 24 hours - no hidden charges!" },
  { name: "Maria G.", location: "Miami, FL", rating: 5, text: "I was worried about my credit score, but AmeriLend worked with me. The processing fee paid upfront is worth it for the fast disbursement!" },
  { name: "David R.", location: "Seattle, WA", rating: 5, text: "Fast, easy, and professional. Paid the processing fee with my debit card and got funds for my medical bills the next day - hassle-free!" },
  { name: "Jennifer L.", location: "Chicago, IL", rating: 5, text: "The mobile app makes everything so convenient. I can manage my loan payments right from my phone!" },
  { name: "Michael P.", location: "Dallas, TX", rating: 5, text: "Excellent rates and flexible payment options. I paid the 3.5% fee via card before disbursement - absolutely no hidden costs!" },
  { name: "Lisa K.", location: "Atlanta, GA", rating: 5, text: "Customer support is top-notch. They explained the payment options for the processing fee and helped me pay with crypto easily!" },
  { name: "Robert H.", location: "Denver, CO", rating: 5, text: "I've used other lenders before, but AmeriLend is by far the best. Paid the processing fee upfront via card - very straightforward!" },
  { name: "Amanda S.", location: "Portland, OR", rating: 5, text: "Got approved even with less than perfect credit. Used Bitcoin to pay the processing fee and funds arrived fast!" },
  { name: "Christopher B.", location: "Boston, MA", rating: 5, text: "Quick turnaround time and competitive rates. Paid the processing fee with my Visa card before disbursement - complete transparency!" },
  { name: "Patricia D.", location: "Las Vegas, NV", rating: 5, text: "The online application took 10 minutes. Paid processing fee via card, money was disbursed next business day - worth every penny!" },
  { name: "Daniel W.", location: "San Diego, CA", rating: 5, text: "Professional, reliable, and trustworthy. The option to pay processing fee via crypto or card is amazing - got my funds fast!" },
  { name: "Jessica F.", location: "Nashville, TN", rating: 5, text: "Great experience from start to finish. The loan officer explained the processing fee payment options clearly - I paid via Mastercard!" },
  { name: "Thomas A.", location: "Charlotte, NC", rating: 5, text: "I needed funds urgently and AmeriLend delivered. Fast approval and same-day funding!" },
  { name: "Michelle C.", location: "Minneapolis, MN", rating: 5, text: "Very impressed with how smooth the process was. No unnecessary paperwork or delays." },
  { name: "Kevin J.", location: "Tampa, FL", rating: 5, text: "The interest rates are reasonable and the payment plans are flexible. Paid the 3.5% fee via card before disbursement - lower than what other lenders charge!" },
  { name: "Rachel N.", location: "Philadelphia, PA", rating: 5, text: "AmeriLend treats you like a person, not just a number. Refreshing customer service!" },
  { name: "Brian M.", location: "San Antonio, TX", rating: 5, text: "Straightforward process with no surprises. The processing fee is paid upfront via card or crypto - everything was exactly as promised!" },
  { name: "Nicole V.", location: "Columbus, OH", rating: 5, text: "I was skeptical at first, but AmeriLend exceeded my expectations. Highly recommended!" },
  { name: "Steven E.", location: "Indianapolis, IN", rating: 5, text: "Great communication throughout the entire process. Paid the processing fee via USDT before disbursement - very competitive rates!" },
  { name: "Kimberly R.", location: "Sacramento, CA", rating: 5, text: "The best part? No prepayment penalties! Just pay the processing fee upfront via card, then I can pay off my loan early without extra fees!" },
  { name: "Joseph L.", location: "Kansas City, MO", rating: 5, text: "Needed money for home repairs and AmeriLend came through. Paid the processing fee via debit card before disbursement - simple and fast!" },
  { name: "Angela W.", location: "Baltimore, MD", rating: 5, text: "Customer service team is incredibly helpful and friendly. They made everything stress-free." },
  { name: "Charles T.", location: "Milwaukee, WI", rating: 5, text: "I've recommended AmeriLend to all my friends. Best online lending platform - pay 3.5% fee upfront via card or crypto, then get your money fast!" },
  { name: "Melissa H.", location: "Albuquerque, NM", rating: 5, text: "The transparency is what I appreciate most. Just the processing fee paid upfront via card before disbursement - no hidden charges whatsoever!" },
  { name: "Richard K.", location: "Louisville, KY", rating: 5, text: "Got my loan approved despite having had financial troubles in the past. Very grateful!" },
  { name: "Laura P.", location: "Oklahoma City, OK", rating: 5, text: "Fast, efficient, and professional service. Paid the processing fee via American Express before disbursement - everything I needed!" },
  { name: "Eric S.", location: "Raleigh, NC", rating: 5, text: "The mobile app is fantastic. Managing my loan has never been easier." },
  { name: "Stephanie B.", location: "Memphis, TN", rating: 5, text: "AmeriLend helped me during a tough financial situation. Forever grateful for their support." },
  { name: "Gregory M.", location: "Richmond, VA", rating: 5, text: "Competitive rates and excellent customer service. What more could you ask for?" },
  { name: "Heather D.", location: "New Orleans, LA", rating: 5, text: "The approval process was incredibly quick. Had my funds within 24 hours!" },
  { name: "Andrew F.", location: "Salt Lake City, UT", rating: 5, text: "Very professional team and easy-to-understand loan terms. No confusion whatsoever." },
  { name: "Christina G.", location: "Birmingham, AL", rating: 5, text: "I was nervous about applying for a loan online, but AmeriLend made it so easy and secure." },
  { name: "Jason R.", location: "Rochester, NY", rating: 5, text: "Great experience! The whole process was seamless from application to funding." },
  { name: "Samantha L.", location: "Grand Rapids, MI", rating: 5, text: "AmeriLend gave me a second chance when other lenders turned me down. Truly appreciate it!" },
  { name: "Matthew W.", location: "Tucson, AZ", rating: 5, text: "Flexible payment options made it easy to fit the loan into my budget. Highly recommend!" },
  { name: "Elizabeth T.", location: "Fresno, CA", rating: 5, text: "The customer support team went above and beyond to help me. Excellent service!" },
  { name: "Ryan C.", location: "Mesa, AZ", rating: 5, text: "Quick approval, fair rates, and great customer service. Everything you need in a lender." },
  { name: "Rebecca N.", location: "Virginia Beach, VA", rating: 5, text: "I love how transparent they are about all fees and terms. No surprises at all!" },
  { name: "Justin H.", location: "Omaha, NE", rating: 5, text: "AmeriLend helped me consolidate my credit card debt. Now I'm on track to being debt-free!" },
  { name: "Katherine M.", location: "Colorado Springs, CO", rating: 5, text: "The application process was so simple, even my tech-challenged dad could do it!" },
  { name: "Brandon S.", location: "Arlington, TX", rating: 5, text: "Fast funding and reasonable terms. Exactly what I needed for my business expenses." },
  { name: "Vanessa P.", location: "Wichita, KS", rating: 5, text: "Outstanding service from start to finish. The team really knows what they're doing." },
  { name: "Timothy J.", location: "St. Louis, MO", rating: 5, text: "I was approved within minutes and had my money the same day. Incredible service!" },
  { name: "Brittany K.", location: "Santa Ana, CA", rating: 5, text: "AmeriLend is legit! No scams, no hidden fees, just honest lending." },
  { name: "Aaron D.", location: "Corpus Christi, TX", rating: 5, text: "The interest rates are very competitive. Saved me money compared to other lenders." },
  { name: "Danielle R.", location: "Lexington, KY", rating: 5, text: "Great for emergencies! Got approved quickly when I needed money for unexpected expenses." },
  { name: "Kenneth L.", location: "Henderson, NV", rating: 5, text: "Professional, courteous, and efficient. AmeriLend sets the standard for online lending." },
  { name: "Amber W.", location: "Plano, TX", rating: 5, text: "The process was painless and the funds arrived exactly when promised. A+ service!" },
  { name: "Derek M.", location: "Lincoln, NE", rating: 5, text: "I've used AmeriLend twice now and both times the experience was excellent." },
  { name: "Courtney F.", location: "Orlando, FL", rating: 5, text: "They worked with my budget to create a payment plan I could actually afford. So helpful!" },
  { name: "Travis B.", location: "Irvine, CA", rating: 5, text: "Best online loan experience ever. Fast, easy, and completely stress-free." },
  { name: "Allison H.", location: "Boise, ID", rating: 5, text: "AmeriLend treated me with respect and dignity. They really care about their customers." },
  { name: "Marcus G.", location: "Spokane, WA", rating: 5, text: "The transparency and honesty of this company is refreshing. Highly recommend!" },
  { name: "Tiffany S.", location: "Des Moines, IA", rating: 5, text: "Got my loan approved even though I'm self-employed. Very flexible and understanding!" },
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
          <h2 className="text-3xl md:text-4xl font-bold text-[#0033A0] mb-4">
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
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-[#FFA500] text-[#FFA500]" />
                    ))}
                  </div>

                  {/* Review Text */}
                  <p className="text-gray-700 mb-6 min-h-[100px] italic">
                    "{testimonial.text}"
                  </p>

                  {/* Customer Info */}
                  <div className="border-t pt-4">
                    <p className="font-semibold text-[#0033A0]">{testimonial.name}</p>
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 max-w-4xl mx-auto">
          <div className="text-center">
            <p className="text-3xl font-bold text-[#0033A0]">50,000+</p>
            <p className="text-gray-600 text-sm">Happy Customers</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#0033A0]">4.9/5</p>
            <p className="text-gray-600 text-sm">Average Rating</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#0033A0]">98%</p>
            <p className="text-gray-600 text-sm">Approval Rate</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-[#0033A0]">24/7</p>
            <p className="text-gray-600 text-sm">Customer Support</p>
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
