#include "example.hpp"

#include <string>
#include <string_view>

namespace vnpt {

std::string greet(std::string_view name) {
    return "Hello, " + std::string{name};
}

}  // namespace vnpt
